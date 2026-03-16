import { serviceRoleDbClient } from "../src/supabase";
import { PrivilegedDbService } from "../src/services/db-service/privileged-db-service";
import { EmbeddingService } from "../src/services/embedding-service";
import { config } from "../src/config";
import { initQueues } from "../src/services/distributed-limiter";
import {
	trimToMistralTokenLimitByWords,
	countMistralTokens,
} from "../src/services/token-utils";

const MISTRAL_EMBED_MAX_TOKENS = config.mistralEmbedMaxContextTokens;

/**
 * Backfills missing Mistral embeddings for document chunks.
 * This script finds all rows in document_chunks where chunk_mistral_embedding is null,
 * generates embeddings using the Mistral API, and updates the database.
 */
async function backfillMistralEmbeddings() {
	// eslint-disable-next-line no-console
	console.log("Starting backfill of Mistral embeddings...");

	const dbService = new PrivilegedDbService(serviceRoleDbClient);
	const embeddingService = new EmbeddingService(dbService);

	await initQueues();

	let totalProcessed = 0;
	let hasMore = true;
	const batchSize = config.mistralEmbedMaxDocumentsPerRequest;

	while (hasMore) {
		// eslint-disable-next-line no-console
		console.log(
			`Fetching next ${batchSize} chunks without Mistral embeddings...`,
		);

		const { data: chunks, error } = await serviceRoleDbClient
			.from("document_chunks")
			.select("id, content")
			.is("chunk_mistral_embedding", null)
			.order("id", { ascending: true })
			.limit(batchSize);

		if (error) {
			console.error("Error fetching chunks:", error);
			process.exit(1);
		}

		if (!chunks || chunks.length === 0) {
			// eslint-disable-next-line no-console
			console.log("No more chunks to process.");
			hasMore = false;
			break;
		}

		const contents = chunks.map((c) => {
			const tokens = countMistralTokens(c.content);
			if (tokens > MISTRAL_EMBED_MAX_TOKENS) {
				// eslint-disable-next-line no-console
				console.warn(
					`Chunk id=${c.id} has ${tokens} tokens, truncating to ${MISTRAL_EMBED_MAX_TOKENS}`,
				);
				return trimToMistralTokenLimitByWords(
					c.content,
					MISTRAL_EMBED_MAX_TOKENS,
				);
			}
			return c.content;
		});

		try {
			// eslint-disable-next-line no-console
			console.log(`Generating embeddings for batch of ${chunks.length}...`);
			const { embeddings } =
				await embeddingService.generateMistralBatchEmbeddings(contents);

			if (embeddings.length !== chunks.length) {
				throw new Error(
					`Expected ${chunks.length} embeddings, got ${embeddings.length}`,
				);
			}

			// eslint-disable-next-line no-console
			console.log(`Updating ${chunks.length} chunks in database...`);
			const updatePromises = chunks.map((chunk, index) => {
				return serviceRoleDbClient
					.from("document_chunks")
					.update({
						chunk_mistral_embedding: JSON.stringify(embeddings[index]),
					})
					.eq("id", chunk.id);
			});

			const results = await Promise.all(updatePromises);
			const batchErrors = results.filter((r) => r.error).map((r) => r.error);

			if (batchErrors.length > 0) {
				console.error(`Errors updating chunks in batch:`, batchErrors);
			}

			totalProcessed += chunks.length;
			// eslint-disable-next-line no-console
			console.log(`Successfully processed ${totalProcessed} chunks so far.`);
		} catch (err) {
			console.error("Error processing batch:", err);
			// For embedding generation errors (API issues), we exit to avoid infinite loops or wasted credits
			process.exit(1);
		}
	}

	// eslint-disable-next-line no-console
	console.log(
		`\n=== Backfill complete! Total chunks processed: ${totalProcessed} ===`,
	);
	process.exit(0);
}

backfillMistralEmbeddings().catch((err) => {
	console.error("Unhandled error during backfill:", err);
	process.exit(1);
});
