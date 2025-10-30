import { tool } from "ai";
import { DatabaseService } from "../services/database-service";
import { EmbeddingService } from "../services/embedding-service";
import { z } from "zod";
import { recordDuration } from "../monitoring/metrics";

const dbService = new DatabaseService();
const embeddingService = new EmbeddingService();

export const ragSearchTool = (
	userId: string,
	allowedDocumentIds: number[],
	allowedFolderIds: number[],
) =>
	tool({
		description:
			"Use this tool to answer questions based on the documents provided by the user. It performs a RAG search over the documents and returns structured, cite-ready matches.",
		// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
		inputSchema: z.object({
			query: z
				.string()
				.describe("The question to answer using the given documents."),
		}),
		// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
		execute: async ({ query }) => {
			const embedding = await embeddingService.generateJinaEmbedding(
				query,
				"retrieval.query",
				userId,
			);
			// do rag search over the base knowledge documents only
			const chunkMatches = await recordDuration("rag-search", async () => {
				return await dbService.performHybridChunkSearch(embedding.embedding, {
					queryText: query,
					allowed_document_ids: allowedDocumentIds,
					allowed_folder_ids: allowedFolderIds,
				});
			});
			if (chunkMatches.length === 0) {
				console.warn(`RAG search found no matches for query: ${query}`);
				return {};
			}

			// For 3 or less documents, we just take their summaries into context
			// For more documents, we leave out any summaries
			let summaries: string[] = [];
			if (allowedDocumentIds.length <= 3) {
				const summariesMap = await recordDuration(
					"supabase-call",
					async () => await dbService.retrieveSummaries(allowedDocumentIds),
				);
				summaries = Array.from(summariesMap.values());
			}

			return {
				documentSummaries: summaries,
				chunkMatches: chunkMatches.map((match) => ({
					chunkId: match.chunk_id,
					snippet: match.chunk_content,
					createdAt: match.created_at,
				})),
			};
		},
	});
