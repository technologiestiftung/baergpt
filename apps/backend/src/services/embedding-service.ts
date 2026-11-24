import { config } from "../config";
import type {
	ParsedPage,
	Document,
	Chunk,
	Embedding,
	EmbeddingResponse,
	EmbeddingsResponse,
} from "../types/common";
import { countMistralTokens } from "./token-utils";
import { BaseContentDbService } from "./db-service/base-db-service";
import { embed, embedMany } from "ai";
import { getEmbeddingModel } from "./llm-provider";
import { captureError } from "../monitoring/capture-error";
import { CHUNK_TARGET_TOKENS, chunkPage } from "./chunking-service";

/** No real pages, so they get the smaller chunk target */
const FILE_TYPES_WITHOUT_PAGES = [".docx", ".md", ".xlsx", ".csv"];

export class EmbeddingService {
	private readonly dbService: BaseContentDbService;
	constructor(dbService: BaseContentDbService) {
		this.dbService = dbService;
	}

	async generateMistralEmbedding(
		input: string,
		/**
		 * userId can be undefined when generating embeddings for default documents
		 * as they are not owned/uploaded by a specific user
		 */
		userId: string | undefined,
	): Promise<EmbeddingResponse> {
		const { embedding, usage } = await embed({
			model: getEmbeddingModel(),
			value: input,
			telemetry: {
				isEnabled: config.isTracingEnabled,
			},
		});

		if (!embedding) {
			throw new Error("Failed to create embedding");
		}

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
			if (tokens > maxTotalTokens) {
				// Skipping would shift the following embeddings onto wrong chunks
				throw new Error(
					`Embedding input has ${tokens} tokens, exceeds max ${maxTotalTokens} per request`,
				);
			}
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
			const { embeddings, usage } = await embedMany({
				model: getEmbeddingModel(),
				values: subBatch,
				telemetry: {
					isEnabled: config.isTracingEnabled,
				},
			});

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

	/** PDF: one chunk per page (up to the limit); other types: smaller target */
	chunkPages(parsedPages: ParsedPage[], document: Document): Chunk[] {
		const maxTokens = config.mistralEmbedMaxContextTokens;
		const fileName = document.source_url.toLowerCase();
		const hasNoRealPages = FILE_TYPES_WITHOUT_PAGES.some((extension) =>
			fileName.endsWith(extension),
		);
		const targetTokens = hasNoRealPages ? CHUNK_TARGET_TOKENS : maxTokens;

		const pagesWithCharacterFallback: number[] = [];

		const chunks = parsedPages.flatMap(({ content, pageNumber }) => {
			const pageChunks = chunkPage(content, { targetTokens, maxTokens });

			if (
				pageChunks.some(({ usedCharacterFallback }) => usedCharacterFallback)
			) {
				pagesWithCharacterFallback.push(pageNumber);
			}

			return pageChunks.map(
				(
					{ content: chunkContent, embeddingInput, tokenCount },
					chunkIndex,
				) => ({
					content: chunkContent,
					embeddingInput,
					page: pageNumber,
					chunkIndex,
					tokenCount,
				}),
			);
		});

		// Usually OCR loops or binary text
		if (pagesWithCharacterFallback.length > 0) {
			captureError(
				new Error(
					"[WARNING] Text without whitespace was split between characters",
				),
				{
					tags: {
						chunking: "character_fallback",
						fileType: fileName.split(".").pop() ?? "unknown",
					},
					extra: {
						pages: pagesWithCharacterFallback,
						embeddingInputTokensPerPage: pagesWithCharacterFallback.map(
							(pageNumber) =>
								chunks
									.filter(({ page }) => page === pageNumber)
									.reduce((sum, { tokenCount }) => sum + tokenCount, 0),
						),
					},
				},
			);
		}

		return chunks;
	}

	async batchEmbed(
		parsedPages: ParsedPage[],
		document: Document,
	): Promise<Embedding[]> {
		const userId = document.owned_by_user_id || document.uploaded_by_user_id;
		const maxChunksPerRequest = config.mistralEmbedMaxDocumentsPerRequest;
		const chunks = this.chunkPages(parsedPages, document);
		const allEmbeddings: Embedding[] = [];

		for (let start = 0; start < chunks.length; start += maxChunksPerRequest) {
			const batch = chunks.slice(start, start + maxChunksPerRequest);
			const { embeddings } = await this.generateMistralBatchEmbeddings(
				batch.map(({ embeddingInput }) => embeddingInput),
				userId,
			);

			// Matched by position
			if (embeddings.length !== batch.length) {
				throw new Error(
					`Expected ${batch.length} embeddings, got ${embeddings.length}`,
				);
			}

			allEmbeddings.push(
				...batch.map(
					({ content, page, chunkIndex }, index) =>
						({
							content,
							embedding: embeddings[index],
							page,
							chunkIndex,
						}) as Embedding,
				),
			);
		}

		return allEmbeddings;
	}
}
