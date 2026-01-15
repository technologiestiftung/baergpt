import { tool } from "ai";
import { BaseContentDbService } from "../services/db-service/base-db-service";
import type { EmbeddingService } from "../services/embedding-service";
import { z } from "zod";

type KnowledgeBaseDocument = {
	id: number;
	folder_id: number;
	file_name: string;
	created_at: string;
	short_summary: string;
	tags: string[];
};

type BaseKnowledgeSearchToolOptions = {
	dbService: BaseContentDbService;
	embeddingService: EmbeddingService;
	userId: string;
	knowledgeBaseDocuments: KnowledgeBaseDocument[];
};

export const baseKnowledgeSearchTool = (
	options: BaseKnowledgeSearchToolOptions,
) =>
	tool({
		description: `
			Use this tool ONLY to answer questions based on the base knowledge documents available to the user. It performs a RAG search over the base knowledge documents about Berlin's public services and returns structured, cite-ready matches.
			These are the available Knowledge Base documents: ${JSON.stringify(
				options.knowledgeBaseDocuments.map((doc) => ({
					file_name: doc.file_name,
					created_at: doc.created_at,
					short_summary: doc.short_summary,
					tags: doc.tags,
				})),
				null,
				2,
			)}.
			`,
		// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
		inputSchema: z.object({
			query: z
				.string()
				.describe("The question to answer using the base knowledge."),
		}),
		// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
		execute: async ({ query }) => {
			const { dbService, embeddingService, userId, knowledgeBaseDocuments } =
				options;

			const allowedDocumentIds = knowledgeBaseDocuments.map((doc) => doc.id);
			const allowedFolderIds = Array.from(
				new Set(knowledgeBaseDocuments.map((doc) => doc.folder_id)),
			);
			const embedding = await embeddingService.generateJinaEmbedding(
				query,
				"retrieval.query",
				userId,
			);
			// do rag search over the base knowledge documents only
			const chunkMatches = await dbService.performHybridChunkSearch(
				embedding.embedding,
				{
					queryText: query,
					allowed_document_ids: allowedDocumentIds,
					allowed_folder_ids: allowedFolderIds,
				},
			);
			if (chunkMatches.length === 0) {
				console.warn(`RAG search found no matches for query: ${query}`);
				return {};
			}

			return {
				chunkMatches: chunkMatches.map((m) => ({
					chunkId: m.chunk_id,
					snippet: m.chunk_content,
					createdAt: m.created_at,
				})),
			};
		},
	});
