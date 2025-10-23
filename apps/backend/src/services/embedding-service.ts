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
import { JINA_MAX_TOKEN_LIMIT } from "../constants";
import { countTokens, computeBatchTokenLimit } from "./token-utils";
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
						late_chunking: true,
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
	 * Merges small chunks from the segmenter response into larger ones based on a minimum token threshold.
	 * @param chunks Array of chunk strings from the segmenter.
	 * @param minTokens Minimum number of tokens per chunk (default: 256).
	 * @returns Array of merged chunk strings.
	 */
	mergeSmallChunks(chunks: string[], minTokens: number = 256): string[] {
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
				buffer = buffer ? `${buffer} ${chunk}` : chunk;
				if (countTokens(buffer) >= minTokens) {
					merged.push(buffer);
					buffer = "";
				}
			}
		}
		if (buffer) {
			merged.push(buffer);
		}
		return merged;
	}

	combineChunksIntoBatches(chunks: Chunk[]): Chunk[][] {
		const batches: Chunk[][] = [];
		let currentBatch: Chunk[] = [];
		let currentBatchTokenCount = 0;

		const safeTokenLimit = computeBatchTokenLimit(JINA_MAX_TOKEN_LIMIT, 1000); // Leave 1000 tokens as safety margin

		for (const chunk of chunks) {
			if (
				currentBatchTokenCount + chunk.tokenCount > safeTokenLimit &&
				currentBatch.length > 0
			) {
				batches.push(currentBatch);
				currentBatch = [chunk];
				currentBatchTokenCount = chunk.tokenCount;
			} else {
				currentBatch.push(chunk);
				currentBatchTokenCount += chunk.tokenCount;
			}
		}

		if (currentBatch.length > 0) {
			batches.push(currentBatch);
		}

		return batches;
	}

	async batchEmbed(
		parsedPages: ParsedPage[],
		document: Document,
		options: {
			chunkingTechnique?: "fixed" | "segmenter";
		} = { chunkingTechnique: "segmenter" },
	): Promise<void> {
		const userId = document.owned_by_user_id || document.uploaded_by_user_id;
		const allChunks: Chunk[] = [];
		const chunkPromises = parsedPages.map(async (page) => {
			let currentChunks: string[] = [];
			const exceedsSegmenterLimit =
				page.content.length >
				EmbeddingService.SEGMENTER_INPUT_MAX -
					EmbeddingService.SEGMENTER_SAFETY_MARGIN;
			if (options.chunkingTechnique === "fixed") {
				currentChunks = this.fixedSizeChunking(page.content);
			} else if (exceedsSegmenterLimit) {
				currentChunks = this.fixedSizeChunking(page.content, 150);
			} else {
				const { chunks } = await this.chunkWithJinaSegmenter(page.content);
				currentChunks = this.mergeSmallChunks(chunks);
			}
			currentChunks.forEach((chunk, index) => {
				const tokenCount = countTokens(chunk);
				allChunks.push({
					content: chunk,
					page: page.pageNumber,
					chunkIndex: index,
					tokenCount,
				} as Chunk);
			});
		});

		await Promise.all(chunkPromises);

		const allEmbeddings: Embedding[] = [];

		const totalTokens = allChunks.reduce(
			(sum, chunk) => sum + chunk.tokenCount,
			0,
		);

		if (totalTokens <= JINA_MAX_TOKEN_LIMIT) {
			const response = await this.generateJinaBatchEmbeddings(
				allChunks.map((c) => c.content),
				"retrieval.passage",
				userId,
			);
			response.embeddings.forEach((embedding, idx) => {
				const { content, page, chunkIndex } = allChunks[idx];
				allEmbeddings.push({
					content,
					embedding,
					page,
					chunkIndex,
				} as Embedding);
			});
		} else {
			const batches = this.combineChunksIntoBatches(allChunks);

			const batchPromises = batches.map(async (batch) => {
				const response = await this.generateJinaBatchEmbeddings(
					batch.map((c) => c.content),
					"retrieval.passage",
					userId,
				);
				response.embeddings.forEach((embedding, idx) => {
					const { content, page, chunkIndex } = batch[idx];
					allEmbeddings.push({
						content,
						embedding,
						page,
						chunkIndex,
					} as Embedding);
				});
			});

			await Promise.all(batchPromises);
		}

		await dbService.logEmbeddings(allEmbeddings, document);
		return;
	}
}
