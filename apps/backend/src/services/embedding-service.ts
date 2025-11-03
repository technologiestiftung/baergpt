import { config } from "../config";
import type {
	ParsedPage,
	Document,
	Chunk,
	Embedding,
	EmbeddingResponse,
	EmbeddingsResponse,
	JinaSegmenterResponse,
	JinaEmbeddingResponse,
} from "../types/common";
import { countTokens } from "./token-utils";
import { DatabaseService } from "./database-service";
import { resilientCall } from "../utils";

const dbService = new DatabaseService();

export class EmbeddingService {
	private static readonly SEGMENTER_INPUT_MAX = 64000; // Jina handles max 64k
	private static readonly SEGMENTER_SAFETY_MARGIN = 2048;

	async chunkWithJinaSegmenter(
		text: string,
		tokenLimit: number = 2000,
	): Promise<JinaSegmenterResponse> {
		const chunkingResponse = await resilientCall(
			async () => {
				const response = await fetch("https://api.jina.ai/v1/segment", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.jinaApiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						content: text,
						return_chunks: true,
						max_chunk_length: tokenLimit,
						tokenizer: "o200k_base",
					}),
				});
				return response;
			},
			{ queueType: "embeddings" },
		);

		if (chunkingResponse.status !== 200) {
			throw new Error("Failed to create chunks");
		}

		const responseData =
			(await chunkingResponse.json()) as JinaSegmenterResponse;
		return responseData;
	}

	async generateJinaEmbedding(
		input: string,
		task: string,
		userId?: string,
	): Promise<EmbeddingResponse> {
		const embeddingResponse = await resilientCall(
			() =>
				fetch("https://api.jina.ai/v1/embeddings", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.jinaApiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: config.jinaEmbeddingModel,
						input: input,
						task: task,
						dimensions: 1024,
						late_chunking: false,
						embedding_type: "float",
					}),
				}),
			{ queueType: "embeddings" },
		);

		if (embeddingResponse.status !== 200) {
			const errorBody = await embeddingResponse.text();
			throw new Error(
				`Failed to create embedding: Status ${embeddingResponse.status}, Body: ${errorBody}`,
			);
		}

		const responseData =
			(await embeddingResponse.json()) as JinaEmbeddingResponse;

		if (!responseData.data || responseData.data.length === 0) {
			throw new Error("Failed to create embedding: empty response");
		}

		// Increase num_embedding_tokens by the amount of tokens from the response if userId is provided
		if (userId) {
			await dbService.updateUserColumnValue(
				userId,
				"num_embedding_tokens",
				responseData.usage.total_tokens,
			);
		}

		return {
			embedding: responseData.data[0].embedding,
			tokenUsage: responseData.usage.total_tokens,
		};
	}

	async generateJinaBatchEmbeddings(
		input: string[],
		task: string,
		userId?: string,
	): Promise<EmbeddingsResponse> {
		const embeddingResponse = await resilientCall(
			async () => {
				const response = await fetch("https://api.jina.ai/v1/embeddings", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.jinaApiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: config.jinaEmbeddingModel,
						input: input,
						task: task,
						dimensions: 1024,
						late_chunking: false,
						embedding_type: "float",
					}),
				});
				return response;
			},
			{ queueType: "embeddings" },
		);

		if (embeddingResponse.status !== 200) {
			const errorBody = await embeddingResponse.text();
			throw new Error(`Failed to create embedding: ${errorBody}`);
		}

		const responseData =
			(await embeddingResponse.json()) as JinaEmbeddingResponse;

		if (!responseData.data || responseData.data.length === 0) {
			throw new Error("Failed to create embedding: empty response");
		}

		// Increase num_embedding_tokens by the amount of tokens from the response if userId is provided
		if (userId) {
			await dbService.updateUserColumnValue(
				userId,
				"num_embedding_tokens",
				responseData.usage.total_tokens,
			);
		}

		const sortedData = responseData.data.sort((a, b) => a.index - b.index);
		return {
			embeddings: sortedData.map((item) => item.embedding),
			tokenUsage: responseData.usage.total_tokens,
		};
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
	 * Falls back to character-based splitting if no separators work.
	 * @param text Text to chunk
	 * @param maxTokens Maximum tokens per chunk
	 * @returns Array of text chunks
	 */
	recursiveChunking(text: string, maxTokens: number = 8000): string[] {
		// Base case: if text is small enough, return as single chunk
		const textTokens = countTokens(text);
		if (textTokens <= maxTokens) {
			return text.trim() ? [text.trim()] : [];
		}

		// Try separators in priority order
		const separators = [
			{ pattern: "\n\n", name: "double-newline" }, // Paragraphs
			{ pattern: "\n", name: "newline" }, // Lines
			{ pattern: ". ", name: "sentence" }, // Sentences
			{ pattern: " ", name: "word" }, // Words
		];

		for (const { pattern } of separators) {
			if (!text.includes(pattern)) {
				continue;
			}

			const parts = text.split(pattern);
			const chunks: string[] = [];
			let currentChunk = "";

			for (const part of parts) {
				// Reconstruct with separator
				const testChunk = currentChunk ? currentChunk + pattern + part : part;
				const testTokens = countTokens(testChunk);

				if (testTokens <= maxTokens) {
					currentChunk = testChunk;
				} else {
					// Save current chunk and start new one
					if (currentChunk) {
						chunks.push(currentChunk.trim());
					}
					currentChunk = part;
				}
			}

			if (currentChunk) {
				chunks.push(currentChunk.trim());
			}

			// Recursively process any chunks that are still too large
			const finalChunks: string[] = [];
			for (const chunk of chunks) {
				const chunkTokens = countTokens(chunk);
				if (chunkTokens > maxTokens) {
					finalChunks.push(...this.recursiveChunking(chunk, maxTokens));
				} else if (chunk.trim()) {
					finalChunks.push(chunk.trim());
				}
			}

			return finalChunks;
		}

		// If no separators work, return the text as a single chunk
		return text.trim() ? [text.trim()] : [];
	}

	/**
	 * Chunks markdown content by structural elements (headers, paragraphs, tables)
	 * while respecting token limits. This preserves semantic meaning better than
	 * fixed-size chunking.
	 */
	markdownStructuralChunking(content: string): string[] {
		const chunks: string[] = [];
		const maxTokens = config.jinaMaxContextTokens;

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

				const paragraphTokens = countTokens(trimmed);

				// If single paragraph exceeds max, use recursive chunking
				if (paragraphTokens > maxTokens) {
					// Flush current chunk first
					if (currentChunk) {
						chunks.push(currentChunk.trim());
						currentChunk = "";
						currentTokens = 0;
					}

					const subChunks = this.recursiveChunking(trimmed, maxTokens);
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
		const maxTokens = config.jinaMaxContextTokens;
		const merged: string[] = [];
		let buffer = "";

		for (const chunk of chunks) {
			const chunkTokenCount = countTokens(chunk);

			if (chunkTokenCount >= minTokens) {
				if (buffer) {
					merged.push(buffer);
					buffer = "";
				}
				merged.push(chunk);
			} else {
				const testBuffer = buffer ? `${buffer} ${chunk}` : chunk;
				const testBufferTokens = countTokens(testBuffer);

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
			chunkingTechnique?: "fixed" | "segmenter" | "markdown";
		} = { chunkingTechnique: "markdown" },
	): Promise<void> {
		const userId = document.owned_by_user_id || document.uploaded_by_user_id;
		const maxChunksPerRequest = config.jinaMaxDocumentsPerRequest;
		const maxTokensPerChunk = config.jinaMaxContextTokens;

		// First pass: chunk all pages and collect all chunks
		const allChunks: Chunk[] = [];

		for (const page of parsedPages) {
			let chunkContents: string[] = [];
			const exceedsSegmenterLimit =
				page.content.length >
				EmbeddingService.SEGMENTER_INPUT_MAX -
					EmbeddingService.SEGMENTER_SAFETY_MARGIN;

			if (options.chunkingTechnique === "fixed") {
				chunkContents = this.fixedSizeChunking(page.content);
			} else if (options.chunkingTechnique === "markdown") {
				chunkContents = this.markdownStructuralChunking(page.content);
			} else if (options.chunkingTechnique === "segmenter") {
				// Use Jina segmenter API
				if (exceedsSegmenterLimit) {
					chunkContents = this.fixedSizeChunking(page.content, 150);
				} else {
					const { chunks } = await this.chunkWithJinaSegmenter(page.content);
					chunkContents = this.mergeSmallChunks(chunks);
				}
			} else {
				chunkContents = this.markdownStructuralChunking(page.content);
			}

			for (let index = 0; index < chunkContents.length; index++) {
				const chunkContent = chunkContents[index];
				const tokenCount = countTokens(chunkContent);
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
					`[WARNING] Chunk exceeds ${maxTokensPerChunk} tokens (${chunk.tokenCount}), skipping chunk from page ${chunk.page}`,
				);
				continue;
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

		// Third pass: process batches in parallel (with concurrency limit)
		// Jina supports 2,000 RPM and 512 documents per batch
		const CONCURRENT_BATCHES = 20; // Process 20 batches at a time (well under 2,000 RPM limit)

		const processBatch = async (batch: Chunk[]): Promise<void> => {
			const response = await this.generateJinaBatchEmbeddings(
				batch.map((c) => c.content),
				"retrieval.passage",
				userId,
			);

			const embeddings: Embedding[] = response.embeddings.map(
				(embedding, idx) =>
					({
						content: batch[idx].content,
						embedding,
						page: batch[idx].page,
						chunkIndex: batch[idx].chunkIndex,
					}) as Embedding,
			);
			await dbService.logEmbeddings(embeddings, document);
		};

		// Process batches with controlled concurrency
		for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
			const batchSlice = batches.slice(i, i + CONCURRENT_BATCHES);
			await Promise.all(batchSlice.map((batch) => processBatch(batch)));
		}
	}
}
