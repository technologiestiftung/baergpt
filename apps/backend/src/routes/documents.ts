import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
import { Document } from "../types/common";
import { getAuthenticatedUserId } from "../middleware/basic-auth";
import { documentProcessSchema } from "../schemas/document-process-schema";
import { ZodError } from "zod";

const documents = new Hono();
const dbService = new DatabaseService();
const embeddingService = new EmbeddingService();
const generationService = new GenerationService();

function validatePersonalSourceUrlPath(
	sourceUrl: string,
	authenticatedUserId: string,
): { valid: boolean; error?: string } {
	const pathPrefix = sourceUrl.split("/")[0];
	if (pathPrefix !== authenticatedUserId) {
		return {
			valid: false,
			error:
				"Unauthorized: source_url must be in your own storage folder for personal documents",
		};
	}
	return { valid: true };
}

function validatePublicSourceUrlPath(
	sourceUrl: string,
	accessGroupId: string,
): { valid: boolean; error?: string } {
	const pathPrefix = sourceUrl.split("/")[0];
	if (pathPrefix !== accessGroupId) {
		return {
			valid: false,
			error:
				"Unauthorized: source_url must match the access_group_id for public documents",
		};
	}
	return { valid: true };
}

documents.post("/process", async (c: Context) => {
	let sourceUrl: string | null = null;
	let bucket: string | null = null;

	try {
		// Get authenticated user ID from context (set by basicAuth middleware)
		const authenticatedUserId = getAuthenticatedUserId(c);

		// Parse and validate request body
		const body = await c.req.json();
		const parseResult = documentProcessSchema.safeParse(body);

		if (!parseResult.success) {
			const errors = parseResult.error.issues
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join("; ");
			return c.json({ error: `Validation failed: ${errors}` }, 400);
		}

		const { document: inputDocument } = parseResult.data;
		sourceUrl = inputDocument.source_url;

		// Determine storage bucket based on source_type
		bucket =
			inputDocument.source_type === "personal_document"
				? "documents"
				: "public_documents";

		// Validate source_url path matches authenticated user
		let pathValidation: { valid: boolean; error?: string } | null = null;
		if (inputDocument.source_type === "personal_document") {
			pathValidation = validatePersonalSourceUrlPath(
				sourceUrl,
				authenticatedUserId,
			);
		} else {
			if (!inputDocument.access_group_id) {
				return c.json(
					{ error: "access_group_id is required for public/default documents" },
					400,
				);
			}
			pathValidation = validatePublicSourceUrlPath(
				sourceUrl,
				inputDocument.access_group_id,
			);
		}
		if (!pathValidation.valid) {
			return c.json({ error: pathValidation.error }, 403);
		}

		// Validate folder ownership if folder_id is provided
		if (
			inputDocument.folder_id !== null &&
			inputDocument.folder_id !== undefined
		) {
			const folderBelongsToUser = await dbService.validateFolderOwnership(
				inputDocument.folder_id,
				authenticatedUserId,
			);
			if (!folderBelongsToUser) {
				return c.json(
					{
						error:
							"Unauthorized: folder_id does not belong to the authenticated user",
					},
					403,
				);
			}
		}

		// Validate file exists in storage (prevents processing arbitrary URLs)
		const fileExists = await dbService.validateFileExistsInStorage(
			sourceUrl,
			bucket,
		);
		if (!fileExists) {
			return c.json(
				{ error: "File not found in storage at the specified source_url" },
				404,
			);
		}

		const llmIdentifier = config.defaultModelIdentifier;

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
		// Handle Zod validation errors separately
		if (error instanceof ZodError) {
			const errors = error.issues
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join("; ");
			return c.json({ error: `Validation failed: ${errors}` }, 400);
		}

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
