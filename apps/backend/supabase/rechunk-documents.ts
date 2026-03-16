import { serviceRoleDbClient } from "../src/supabase";
import { PrivilegedDbService } from "../src/services/db-service/privileged-db-service";
import { EmbeddingService } from "../src/services/embedding-service";
import { initQueues } from "../src/services/distributed-limiter";
import type { Document } from "../src/types/common";

const DEFAULT_DOC_IDS = [7256, 7262, 7263, 7380];

/**
 * Re-chunks and re-embeds documents that were previously ingested with oversized chunks.
 * This script deletes the existing chunks for specific document IDs and runs the
 * current chunking and embedding pipeline to create properly-sized chunks.
 */
async function rechunkDocuments(targetDocIds: number[]) {
	// eslint-disable-next-line no-console
	console.log(
		`Starting re-chunking for documents: ${targetDocIds.join(", ")}...`,
	);

	const dbService = new PrivilegedDbService(serviceRoleDbClient);
	const embeddingService = new EmbeddingService(dbService);

	await initQueues();

	for (const docId of targetDocIds) {
		// eslint-disable-next-line no-console
		console.log(`\n--- Processing Document ID: ${docId} ---`);

		// 1. Fetch document metadata
		const { data: document, error: fetchError } = await serviceRoleDbClient
			.from("documents")
			.select("*")
			.eq("id", docId)
			.single();

		if (fetchError || !document) {
			console.error(`Error fetching document ${docId}:`, fetchError);
			continue;
		}

		const baseDoc: Document = {
			id: document.id,
			source_url: document.source_url,
			source_type: document.source_type,
			created_at: document.created_at ?? new Date().toISOString(),
			owned_by_user_id: document.owned_by_user_id ?? undefined,
			uploaded_by_user_id: document.uploaded_by_user_id ?? undefined,
			access_group_id: document.access_group_id ?? undefined,
			file_checksum: document.file_checksum ?? undefined,
			file_size: document.file_size ?? undefined,
			num_pages: document.num_pages ?? undefined,
			folder_id: document.folder_id ?? undefined,
			processing_finished_at: document.processing_finished_at ?? undefined,
		};

		// Used for embedding: user IDs are cleared so batchEmbed does not attempt to
		// update per-user token counters via PrivilegedDbService (forbidden there).
		const docForEmbed: Document = {
			...baseDoc,
			owned_by_user_id: undefined,
			uploaded_by_user_id: undefined,
		};

		const docForStorage: Document = { ...baseDoc };

		try {
			// 2. Delete existing chunks
			// eslint-disable-next-line no-console
			console.log(`Deleting existing chunks for document ${docId}...`);
			const { error: deleteError } = await serviceRoleDbClient
				.from("document_chunks")
				.delete()
				.eq("document_id", docId);

			if (deleteError) {
				throw new Error(`Failed to delete chunks: ${deleteError.message}`);
			}

			// 3. Re-extract document content from storage
			// eslint-disable-next-line no-console
			console.log(`Extracting content for ${docForStorage.source_url}...`);
			const extractionResult = await dbService.extractDocument(docForStorage);

			// 4. Re-chunk and embed using current pipeline
			// eslint-disable-next-line no-console
			console.log(`Re-chunking and generating Mistral embeddings...`);
			const embeddings = await embeddingService.batchEmbed(
				extractionResult.parsedPages,
				docForEmbed,
				{ chunkingTechnique: "markdown" },
			);

			// 5. Log new chunks/embeddings with original ownership
			// eslint-disable-next-line no-console
			console.log(`Inserting ${embeddings.length} new chunks...`);
			await dbService.logEmbeddings(embeddings, docForStorage);

			// eslint-disable-next-line no-console
			console.log(`Successfully re-chunked document ${docId}.`);
		} catch (err) {
			console.error(`Error processing document ${docId}:`, err);
		}
	}

	// eslint-disable-next-line no-console
	console.log("\n=== Re-chunking complete! ===");
	process.exit(0);
}

// Allow passing IDs via CLI, otherwise use defaults
const args = process.argv.slice(2);
const docIdsToProcess = args.length > 0 ? args.map(Number) : DEFAULT_DOC_IDS;

rechunkDocuments(docIdsToProcess).catch((err) => {
	console.error("Unhandled error:", err);
	process.exit(1);
});
