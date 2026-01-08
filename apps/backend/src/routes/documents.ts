import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { captureError } from "../monitoring/capture-error";
import { Document } from "../types/common";
import { getAuthenticatedUserId } from "../middleware/basic-auth";
import { documentProcessSchema } from "../schemas/document-process-schema";
import { ZodError } from "zod";
import { ValidationService } from "../services/validation-service";

const documents = new Hono();
const dbService = new DatabaseService();
const embeddingService = new EmbeddingService();
const generationService = new GenerationService();
const validationService = new ValidationService();

documents.post("/process", async (c: Context) => {
	let sourceUrl: string | null = null;
	let bucket: string | null = null;

	try {
		// Get authenticated user ID from context (set by basicAuth middleware)
		const authenticatedUserId = getAuthenticatedUserId(c);

		// Parse and validate request body
		const body = await c.req.json();
		const llmIdentifier = body.llm_model as string;
		if (!llmIdentifier || typeof llmIdentifier !== "string") {
			return c.json(
				{
					error: "Invalid request: llm_model is required and must be a string",
				},
				400,
			);
		}
		const parseResult = documentProcessSchema.parse(body);

		const { document: inputDocument } = parseResult;
		sourceUrl = inputDocument.source_url;

		// Validate document request (path, folder ownership, file existence)
		const validationResult = await validationService.validateDocumentRequest(
			inputDocument,
			authenticatedUserId,
		);
		if (validationResult.success === false) {
			captureError(new Error(validationResult.error));
			return c.json({ error: validationResult.error }, validationResult.status);
		}
		bucket = validationResult.bucket;

		// Step 1: Extract document content (no DB record created yet)
		const documentForExtraction: Document = {
			source_url: sourceUrl,
			source_type: inputDocument.source_type,
			created_at: inputDocument.created_at || new Date().toISOString(),
		};
		const extractionResult = await dbService.extractDocument(
			documentForExtraction,
		);

		// Step 2: Process document (embed and summarize)
		// Always use authenticated user ID, never trust client input for owned_by_user_id
		const documentForProcessing: Document = {
			folder_id: inputDocument.folder_id ?? undefined,
			owned_by_user_id:
				inputDocument.source_type === "personal_document"
					? authenticatedUserId
					: undefined,
			created_at: inputDocument.created_at || new Date().toISOString(),
			access_group_id: inputDocument.access_group_id ?? undefined,
			uploaded_by_user_id:
				inputDocument.source_type !== "personal_document"
					? authenticatedUserId
					: undefined,
			source_url: sourceUrl,
			source_type: inputDocument.source_type,
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
		await dbService.logProcessedDocument(
			documentForProcessing,
			summaryData,
			embeddings,
		);

		return c.body(null, 204);
	} catch (error) {
		captureError(error);

		// Handle Zod validation errors separately
		if (error instanceof ZodError) {
			const errors = error.issues
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join("; ");
			return c.json({ error: `Validation failed: ${errors}` }, 400);
		}

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
