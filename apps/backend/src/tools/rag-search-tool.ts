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

const MAX_DOCUMENT_SUMMARIES_TO_INCLUDE = 3;

export const ragSearchTool = async (options: RagSearchToolOptions) => {
	const {
		dbService,
		allowedDocumentIds,
		allowedFolderIds,
		embeddingService,
		userId,
	} = options;

	const documentsSummaries = await dbService.retrieveSummaries(
		allowedDocumentIds,
		allowedFolderIds,
	);

	return tool({
		description: `Use this tool to answer any question about the documents the user has added to this chat.
ALWAYS call this tool before answering — do NOT rely on prior knowledge when documents are present.

These are the documents available in this chat:
${JSON.stringify(
	documentsSummaries.map((doc) => ({
		file_name: doc.file_name,
		short_summary: doc.short_summary,
	})),
	null,
	2,
)}.`,
		inputSchema: z.object({
			query: z
				.string()
				.describe("The question to answer using the given documents."),
		}),
		execute: async ({ query }) => {
			const embedding = await embeddingService.generateMistralEmbedding(
				query,
				userId,
			);

			const chunkMatches = await dbService.performHybridChunkSearch(
				embedding.embedding,
				{
					queryText: query,
					allowed_document_ids: allowedDocumentIds,
					allowed_folder_ids: allowedFolderIds,
				},
			);

			if (chunkMatches.length === 0) {
				return {};
			}

			const documentSummariesForContext =
				allowedDocumentIds.length <= MAX_DOCUMENT_SUMMARIES_TO_INCLUDE
					? documentsSummaries
					: [];

			return {
				documentSummaries: documentSummariesForContext,
				chunkMatches: chunkMatches.map((match) => ({
					chunkId: match.chunk_id,
					snippet: match.chunk_content,
					createdAt: match.created_at,
				})),
			};
		},
	});
};
