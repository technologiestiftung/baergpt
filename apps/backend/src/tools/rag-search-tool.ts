import { tool } from "ai";
import { BaseContentDbService } from "../services/db-service/base-db-service";
import type { EmbeddingService } from "../services/embedding-service";
import { z } from "zod";

type RagSearchToolOptions = {
	dbService: BaseContentDbService;
	embeddingService: EmbeddingService;
	userId: string;
	allowedDocumentIds: number[];
	allowedFolderIds: number[];
};

export const ragSearchTool = (options: RagSearchToolOptions) =>
	tool({
		description:
			"Searches the documents the user has attached to this chat (PDF, Word, Excel). Call this tool whenever the user asks about document content — even for vague questions like 'Was steht im Dokument?', 'Worum geht es?', 'Fasse das zusammen', 'Erkläre mir das'. Always call this tool BEFORE asking the user to clarify or before saying you don't have information. Use the user's question verbatim as the query if unsure.",
		inputSchema: z.object({
			query: z
				.string()
				.describe("The question to answer using the given documents."),
		}),
		execute: async ({ query }) => {
			const {
				dbService,
				embeddingService,
				userId,
				allowedDocumentIds,
				allowedFolderIds,
			} = options;

			const embedding = await embeddingService.generateMistralEmbedding(
				query,
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

			// For 3 or less documents, we just take their summaries into context
			// For more documents, we leave out any summaries
			let summaries: string[] = [];
			if (allowedDocumentIds.length <= 3) {
				const summariesMap =
					await dbService.retrieveSummaries(allowedDocumentIds);
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
