import { config } from "../config";
import type {
	ParsedPage,
	Document,
	Chunk,
	Embedding,
	EmbeddingResponse,
	EmbeddingsResponse,
} from "../types/common";
import {
	countMistralTokens,
	trimToMistralTokenLimitByWords,
} from "./token-utils";
import { BaseContentDbService } from "./db-service/base-db-service";
import { resilientCall } from "../utils";
import { embed, embedMany } from "ai";
import { mistral } from "@ai-sdk/mistral";

export class EmbeddingService {
	private readonly dbService: BaseContentDbService;
	constructor(dbService: BaseContentDbService) {
		this.dbService = dbService;
	}

	async generateMistralEmbedding(
		input: string,
		userId?: string,
	): Promise<EmbeddingResponse> {
		const { embedding, usage } = await resilientCall(
			async () => {
				return await embed({
					model: mistral.embeddingModel(config.mistralEmbeddingModel),
					value: input,
				});
			},
			{ queueType: "embeddings" },
		);

		if (!embedding) {
			throw new Error("Failed to create embedding");
		}

		// Increase num_embedding_tokens by the amount of tokens from the response if userId is provided
		if (userId) {
			await this.dbService.updateUserColumnValue(
				userId,
				"num_embedding_tokens",
				usage.tokens,
			);
		}

		return { embedding: embedding, tokenUsage: usage.tokens };
	}

	async generateMistralBatchEmbeddings(
		inputs: string[],
		userId?: string,
	): Promise<EmbeddingsResponse> {
		const maxPerCall = config.mistralEmbedMaxDocumentsPerRequest;
		const maxTotalTokens = config.mistralEmbedMaxTotalTokensPerRequest;

		const subBatches: string[][] = [];
		let current: string[] = [];
		let currentTokens = 0;

		for (const input of inputs) {
			const tokens = countMistralTokens(input);
			if (
				current.length > 0 &&
				(current.length >= maxPerCall ||
					currentTokens + tokens > maxTotalTokens)
			) {
				subBatches.push(current);
				current = [];
				currentTokens = 0;
			}
			current.push(input);
			currentTokens += tokens;
		}
		if (current.length > 0) {
			subBatches.push(current);
		}

		const allEmbeddings: number[][] = [];
		let totalTokenUsage = 0;

		for (const subBatch of subBatches) {
			const { embeddings, usage } = await resilientCall(
				async () => {
					return await embedMany({
						model: mistral.embeddingModel(config.mistralEmbeddingModel),
						values: subBatch,
					});
				},
				{ queueType: "embeddings" },
			);

			if (!embeddings) {
				throw new Error("Failed to create embeddings");
			}

			allEmbeddings.push(...embeddings);
			totalTokenUsage += usage.tokens;
		}

		if (userId) {
			await this.dbService.updateUserColumnValue(
				userId,
				"num_embedding_tokens",
				totalTokenUsage,
			);
		}

		return { embeddings: allEmbeddings, tokenUsage: totalTokenUsage };
	}

	// Utility s for chunking and batch processing
	fixedSizeChunking(content: string, wordsPerChunk: number = 100): string[] {
		const words = content.split(/\s+/);
		const chunks: string[] = [];

		for (let i = 0; i < words.length; i += wordsPerChunk) {
			const chunkWords = words.slice(i, i + wordsPerChunk);
			const chunk = chunkWords.join(" ");
			chunks.push(chunk);
		}

		return chunks;
	}

	/**
	 * Recursively chunks text by trying different separators in priority order.
	 * If no separators work (edge case like very long URLs, base64, etc.),
	 * returns empty array to skip the chunk, as such content is typically not useful for semantic search.
	 * @param text Text to chunk
	 * @returns Array of text chunks, or empty array if content cannot be properly chunked
	 */
	recursiveChunking(text: string): string[] {
		const maxTokens = config.mistralEmbedMaxContextTokens;
		// Base case: if text is small enough, return as single chunk
		const textTokens = countMistralTokens(text);
		if (textTokens <= maxTokens) {
			return text.trim() ? [text.trim()] : [];
		}

		// Early exit: if text has no word boundaries at all, it's unchunkable
		if (!text.includes(" ") && !text.includes("\n") && !text.includes(". ")) {
			console.warn(
				`[WARNING] Skipping unchunkable content with ${textTokens} tokens (no word boundaries found). Preview: ${text.slice(0, 100)}...`,
			);
			return [];
		}

		// Try separators in priority order
		const separators = [
			{ pattern: "\n", name: "newline" }, // Lines
			{ pattern: ". ", name: "sentence" }, // Sentences
			{ pattern: " ", name: "word" }, // Words
		];

		for (const { pattern, name } of separators) {
			if (!text.includes(pattern)) {
				continue;
			}

			const parts = text.split(pattern);
			const chunks: string[] = [];
			let currentChunk = "";

			// For word splitting, use binary search optimization to avoid O(n²) complexity
			if (name === "word") {
				let remaining = text;
				while (remaining.trim()) {
					const trimmed = trimToMistralTokenLimitByWords(remaining, maxTokens);
					if (!trimmed) {
						break;
					}

					chunks.push(trimmed.trim());
					remaining = remaining.slice(trimmed.length).trim();
				}
				return chunks.filter((c) => c.trim().length > 0);
			}
			for (const part of parts) {
				// Reconstruct with separator
				const testChunk = currentChunk ? currentChunk + pattern + part : part;
				const testTokens = countMistralTokens(testChunk);
				if (testTokens <= maxTokens) {
					currentChunk = testChunk;
					continue;
				}
				if (currentChunk) {
					chunks.push(currentChunk.trim());
				}
				currentChunk = part;
			}
			// push any remaining chunk
			if (currentChunk) {
				chunks.push(currentChunk.trim());
			}
			// Recursively process any chunks that are still too large
			const finalChunks: string[] = [];
			for (const chunk of chunks) {
				const chunkTokens = countMistralTokens(chunk);
				if (chunkTokens > maxTokens) {
					finalChunks.push(...this.recursiveChunking(chunk));
				} else if (chunk.trim()) {
					finalChunks.push(chunk.trim());
				}
			}

			return finalChunks;
		}

		console.warn(
			`[WARNING] Skipping unchunkable content with ${textTokens} tokens (no word boundaries found). Preview: ${text.slice(0, 100)}...`,
		);
		return [];
	}

	/**
	 * Chunks markdown content by structural elements (headers, paragraphs, tables)
	 * while respecting token limits. This preserves semantic meaning better than
	 * fixed-size chunking.
	 */
	markdownStructuralChunking(content: string): string[] {
		const chunks: string[] = [];
		const maxTokens = config.mistralEmbedMaxContextTokens;

		// Split by markdown headers and major structural elements
		const sections = content.split(/(?=^#{1,6}\s)/gm);

		let currentChunk = "";
		let currentTokens = 0;

		for (const section of sections) {
			// Further split section by paragraphs (double newline)
			const paragraphs = section.split(/\n\s*\n/);

			for (const paragraph of paragraphs) {
				const trimmed = paragraph.trim();
				if (!trimmed) {
					continue;
				}

				const paragraphTokens = countMistralTokens(trimmed);

				// If single paragraph exceeds max, use recursive chunking
				if (paragraphTokens > maxTokens) {
					// Flush current chunk first
					if (currentChunk) {
						chunks.push(currentChunk.trim());
						currentChunk = "";
						currentTokens = 0;
					}

					const subChunks = this.recursiveChunking(trimmed);
					chunks.push(...subChunks);
					continue;
				}

				if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
					chunks.push(currentChunk.trim());
					currentChunk = trimmed;
					currentTokens = paragraphTokens;
				} else {
					currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
					currentTokens += paragraphTokens;
				}
			}
		}

		if (currentChunk) {
			chunks.push(currentChunk.trim());
		}

		return chunks.filter((c) => c.length > 0);
	}

	/**
	 * Merges small chunks from the segmenter response into larger ones based on a minimum token threshold.
	 * @param chunks Array of chunk strings from the segmenter.
	 * @param minTokens Minimum number of tokens per chunk (default: 256).
	 * @returns Array of merged chunk strings.
	 */
	mergeSmallChunks(chunks: string[], minTokens: number = 256): string[] {
		const maxTokens = config.mistralEmbedMaxContextTokens;
		const merged: string[] = [];
		let buffer = "";

		for (const chunk of chunks) {
			const chunkTokenCount = countMistralTokens(chunk);

			if (chunkTokenCount >= minTokens) {
				if (buffer) {
					merged.push(buffer);
					buffer = "";
				}
				merged.push(chunk);
			} else {
				const testBuffer = buffer ? `${buffer} ${chunk}` : chunk;
				const testBufferTokens = countMistralTokens(testBuffer);

				// If adding this chunk would exceed maxTokens, flush buffer first
				if (testBufferTokens > maxTokens && buffer) {
					merged.push(buffer);
					buffer = chunk;
				} else {
					buffer = testBuffer;
					if (testBufferTokens >= minTokens) {
						merged.push(buffer);
						buffer = "";
					}
				}
			}
		}
		if (buffer) {
			merged.push(buffer);
		}
		return merged;
	}

	async batchEmbed(
		parsedPages: ParsedPage[],
		document: Document,
		options: {
			chunkingTechnique?: "fixed" | "markdown";
		} = { chunkingTechnique: "markdown" },
	): Promise<Embedding[]> {
		const userId = document.owned_by_user_id || document.uploaded_by_user_id;
		const maxChunksPerRequest = config.mistralEmbedMaxDocumentsPerRequest;
		const maxTokensPerChunk = config.mistralEmbedMaxContextTokens;

		// First pass: chunk all pages and collect all chunks
		const allChunks: Chunk[] = [];

		for (const page of parsedPages) {
			let chunkContents: string[] = [];
			if (options.chunkingTechnique === "fixed") {
				chunkContents = this.fixedSizeChunking(page.content);
			} else if (options.chunkingTechnique === "markdown") {
				chunkContents = this.markdownStructuralChunking(page.content);
			}

			for (let index = 0; index < chunkContents.length; index++) {
				const chunkContent = chunkContents[index];
				const tokenCount = countMistralTokens(chunkContent);
				allChunks.push({
					content: chunkContent,
					page: page.pageNumber,
					chunkIndex: index,
					tokenCount,
				});
			}
		}

		// Second pass: group chunks into batches
		const batches: Chunk[][] = [];
		let currentBatch: Chunk[] = [];

		for (const chunk of allChunks) {
			if (chunk.tokenCount > maxTokensPerChunk) {
				console.warn(
					`[WARNING] Chunk exceeds ${maxTokensPerChunk} tokens (${chunk.tokenCount}), truncating chunk from page ${chunk.page}`,
				);
				chunk.content = trimToMistralTokenLimitByWords(
					chunk.content,
					maxTokensPerChunk,
				);
				chunk.tokenCount = maxTokensPerChunk;
			}

			if (currentBatch.length >= maxChunksPerRequest) {
				batches.push(currentBatch);
				currentBatch = [];
			}

			currentBatch.push(chunk);
		}

		if (currentBatch.length > 0) {
			batches.push(currentBatch);
		}

		// Third pass: process batches sequentially
		const allEmbeddings: Embedding[] = [];

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];

			const response = await this.generateMistralBatchEmbeddings(
				batch.map((c) => c.content),
				userId,
			);

			const batchEmbeddings = response.embeddings.map(
				(embedding, idx) =>
					({
						content: batch[idx].content,
						embedding,
						page: batch[idx].page,
						chunkIndex: batch[idx].chunkIndex,
					}) as Embedding,
			);

			allEmbeddings.push(...batchEmbeddings);

			// Yield to event loop after each batch
			// This allows Redis heartbeats and other I/O to proceed
			if (i < batches.length - 1) {
				await new Promise((resolve) => setImmediate(resolve));
			}
		}

		return allEmbeddings;
	}
}
