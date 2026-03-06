import { config } from "../config";
import type {
	ParsedPage,
	Document,
	Chunk,
	Embedding,
	EmbeddingResponse,
	EmbeddingsResponse,
	JinaEmbeddingResponse,
} from "../types/common";
import { countTokens, trimToTokenLimitByWords } from "./token-utils";
import { BaseContentDbService } from "./db-service/base-db-service";
import { resilientCall } from "../utils";

export class EmbeddingService {
	private readonly dbService: BaseContentDbService;
	constructor(dbService: BaseContentDbService) {
		this.dbService = dbService;
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
						dimensions: config.jinaEmbeddingDimensions,
						late_chunking: false,
						embedding_type: "float",
						truncate: true,
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
			await this.dbService.updateUserColumnValue(
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
		inputs: { [key: string]: string }[],
		task: string,
		userId?: string,
	): Promise<EmbeddingsResponse> {
		const embeddingResponse = await resilientCall(
			async () =>
				fetch("https://api.jina.ai/v1/embeddings", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.jinaApiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: config.jinaEmbeddingModel,
						input: inputs,
						task: task,
						dimensions: config.jinaEmbeddingDimensions,
						late_chunking: false,
						embedding_type: "float",
						truncate: true,
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
			await this.dbService.updateUserColumnValue(
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

	/**
	 * Recursively chunks text by trying different separators in priority order.
	 * If no separators work (edge case like very long URLs, base64, etc.),
	 * returns empty array to skip the chunk, as such content is typically not useful for semantic search.
	 * @param text Text to chunk
	 * @returns Array of text chunks, or empty array if content cannot be properly chunked
	 */
	recursiveChunking(text: string): string[] {
		const maxTokens = config.jinaMaxContextTokens;
		// Base case: if text is small enough, return as single chunk
		const textTokens = countTokens(text);
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
					const trimmed = trimToTokenLimitByWords(remaining, maxTokens);
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
				const testTokens = countTokens(testChunk);
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
				const chunkTokens = countTokens(chunk);
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

	async batchEmbed(
		parsedPages: ParsedPage[],
		document: Document,
	): Promise<Embedding[]> {
		const userId = document.owned_by_user_id || document.uploaded_by_user_id;
		const maxChunksPerRequest = config.jinaMaxDocumentsPerRequest;
		const maxTokensPerChunk = config.jinaMaxContextTokens;

		// First pass: chunk all pages and collect all chunks
		const allChunks: Chunk[] = [];

		for (const page of parsedPages) {
			let chunkContents: string[] = [];

			chunkContents = this.markdownStructuralChunking(page.content);

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
				// TODO - why is this just a warning? Shouldn't we try to split the chunk up further instead of skipping it entirely?
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

		// Third pass: process batches sequentially
		const allEmbeddings: Embedding[] = [];

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];

			const response = await this.generateJinaBatchEmbeddings(
				batch.map((c) => ({ text: c.content })),
				"retrieval.passage",
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

			//  todo why do we need this? generateJinaBatchEmbeddings is async, so it should yield to event loop naturally between batches
			// // Yield to event loop after each batch
			// // This allows Redis heartbeats and other I/O to proceed
			// if (i < batches.length - 1) {
			// 	await new Promise((resolve) => setImmediate(resolve));
			// }
		}

		return allEmbeddings;
	}
}
