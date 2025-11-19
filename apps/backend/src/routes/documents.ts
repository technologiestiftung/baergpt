import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
import { Document } from "../types/common";

const documents = new Hono();
const dbService = new DatabaseService();
const embeddingService = new EmbeddingService();
const generationService = new GenerationService();

documents.post("/process", async (c: Context) => {
	let sourceUrl: string | null = null;
	let bucket: string | null = null;
	try {
		const body = await c.req.json();
		const { document } = body;
		sourceUrl = document.source_url;
		bucket =
			document.source_type === "personal_document"
				? "documents"
				: "public_documents";
		const llmIdentifier = config.defaultModelIdentifier;

		// Step 1: Extract document content (no DB record created yet)
		const extractionResult = await dbService.extractDocument(document);

		// Step 2: Process document (embed and summarize)
		// Create temporary document object with extraction metadata for processing
		const documentForProcessing: Document = {
			id: null,
			folder_id: document.folder_id,
			owned_by_user_id: document.owned_by_user_id,
			created_at: document.created_at,
			access_group_id: document.access_group_id,
			uploaded_by_user_id: document.uploaded_by_user_id,
			source_url: document.source_url,
			source_type: document.source_type,
			file_checksum: extractionResult.checksum,
			file_size: extractionResult.fileSize,
			num_pages: extractionResult.numPages,
		};

		const parsedPages = extractionResult.parsedPages;
		const [summaryData, embeddings] = await Promise.all([
			generationService.summarize(
				parsedPages,
				llmIdentifier,
				documentForProcessing,
			),
			embeddingService.batchEmbed(parsedPages, documentForProcessing, {
				chunkingTechnique: "markdown",
			}),
		]);

		// Step 3: Create complete document record
		await dbService.logProcessedDocument(documentForProcessing, summaryData, embeddings);

		return c.body(null, 204);
	} catch (error) {
		captureError(error);
		// If processing failed, clean up the storage file
		if (sourceUrl !== null && bucket !== null) {
			try {
				await dbService.deleteFileFromStorage(sourceUrl, bucket);
			} catch (cleanupError) {
				captureError(
					new Error(
						`Failed to cleanup document ${sourceUrl} after processing error: ${cleanupError}`,
					),
				);
			}
		}
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default documents;
