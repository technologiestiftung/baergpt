import { Hono } from "hono";
import type { Context } from "hono";
import { UserScopedDbService } from "../services/db-service/user-scoped-db-service";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { captureError } from "../monitoring/capture-error";
import {
	Document,
	DefaultDocumentDeletionError,
	DocumentNotFoundError,
} from "../types/common";
import { documentProcessSchema } from "../schemas/document-process-schema";
import { ZodError } from "zod";
import { ValidationService } from "../services/validation-service";

const documents = new Hono();

documents.post("/process", async (c: Context) => {
	const userClient = c.get("UserScopedDbClient");
	const userScopedDbService = new UserScopedDbService(userClient);
	const embeddingService = new EmbeddingService(userScopedDbService);
	const generationService = new GenerationService(userScopedDbService);
	const validationService = new ValidationService(userScopedDbService);

	let sourceUrl: string | null = null;
	let bucket: string | null = null;

	try {
		// Get authenticated user ID from context (set by basicAuth middleware)
		const authenticatedUserId = c.get("authenticatedUserId");
		// Parse and validate request body
		const body = await c.req.json();
		const parseResult = documentProcessSchema.parse(body);

		const { document: inputDocument, llm_model: llmIdentifier } = parseResult;
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
		const extractionResult = await userScopedDbService.extractDocument(
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
		await userScopedDbService.logProcessedDocument(
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
				await userScopedDbService.deleteFileFromStorage(sourceUrl, bucket);
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

documents.delete("/:documentId", async (c: Context) => {
	const userClient = c.get("UserScopedDbClient");
	const userScopedDbService = new UserScopedDbService(userClient);
	const documentId = c.req.param("documentId");
	const authenticatedUserId = c.get("authenticatedUserId");

	if (!authenticatedUserId) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const parsedDocumentId = Number(documentId);
	if (isNaN(parsedDocumentId)) {
		return c.json({ error: "Invalid document ID" }, 400);
	}

	try {
		await userScopedDbService.deleteDocument(
			parsedDocumentId,
			authenticatedUserId,
		);
		return c.body(null, 204);
	} catch (error) {
		if (error instanceof DocumentNotFoundError) {
			return c.json({ error: "Document not found" }, 404);
		}
		if (error instanceof DefaultDocumentDeletionError) {
			return c.json({ error: "Default documents cannot be deleted" }, 403);
		}
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default documents;
