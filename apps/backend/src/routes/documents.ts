import crypto from "crypto";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { UserScopedDbService } from "../services/db-service/user-scoped-db-service";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { captureError } from "../monitoring/capture-error";
import {
	Document,
	DefaultDocumentDeletionError,
	DocumentNotFoundError,
} from "../types/common";
import { ZodError } from "zod";
import { ValidationService } from "../services/validation-service";
import { logMemory } from "../monitoring/memory-logger";
import { config } from "../config";

const documents = new Hono();

documents.post("/process", async (c: Context) =>
	streamSSE(c, async (stream) => {
		const userClient = c.get("UserScopedDbClient");
		const userScopedDbService = new UserScopedDbService(userClient);
		const embeddingService = new EmbeddingService(userScopedDbService);
		const generationService = new GenerationService(userScopedDbService);
		const validationService = new ValidationService(userScopedDbService);

		let documentId: number | null = null;

		const userId: string = c.get("authenticatedUserId");
		const reqId =
			config.nodeEnv === "production"
				? crypto.randomUUID().slice(0, 8)
				: (userId?.slice(0, 8) ?? "no-user");

		try {
			logMemory("doc:start", reqId);
			// Parse and validate request body
			const body = await c.req.parseBody();

			// Validate document request (path, folder ownership, file existence)
			const {
				sourceUrl,
				sourceType,
				createdAt,
				llmModel,
				bucket,
				file,
				folderId,
				accessGroupId,
			} = await validationService.validateDocumentRequest({
				body,
				userId,
			});

			await stream.writeSSE({
				data: JSON.stringify({
					status: "processing",
				}),
			});

			// Step 1: Extract document content (no DB record created yet)
			const documentForExtraction = {
				source_url: sourceUrl,
				source_type: sourceType,
				created_at: createdAt,
			};

			const extractionResult = await userScopedDbService.extractDocument(
				documentForExtraction,
				file,
			);

			logMemory(
				`doc:after-extract (pages=${extractionResult.numPages}, size=${extractionResult.fileSize})`,
				reqId,
			);

			// Step 2: Process document (embed and summarize)
			// Always use authenticated user ID, never trust client input for owned_by_user_id
			const documentForProcessing: Document = {
				folder_id: folderId ?? undefined,
				owned_by_user_id:
					sourceType === "personal_document" ? userId : undefined,
				created_at: createdAt,
				access_group_id: accessGroupId,
				uploaded_by_user_id:
					sourceType !== "personal_document" ? userId : undefined,
				source_url: sourceUrl,
				file_name: file.name,
				source_type: sourceType,
				file_checksum: extractionResult.checksum,
				file_size: extractionResult.fileSize,
				num_pages: extractionResult.numPages,
			};

			const parsedPages = extractionResult.parsedPages;
			const [summaryData, embeddings] = await Promise.all([
				generationService.summarize(
					parsedPages,
					llmModel,
					documentForProcessing,
				),
				embeddingService.batchEmbed(parsedPages, documentForProcessing),
			]);

			logMemory(
				`doc:after-embed+summarize (chunks=${embeddings.length})`,
				reqId,
			);

			// Step 3: Create complete document record
			documentId = await userScopedDbService.logProcessedDocument(
				documentForProcessing,
				summaryData,
				embeddings,
			);

			// Step 4: Upload file to storage
			await userScopedDbService.uploadFileToStorage(sourceUrl, file, bucket);

			if (c.req.raw.signal.aborted) {
				await cleanup({
					userScopedDbService,
					userId,
					documentId,
				});
				return stream.writeSSE({
					data: JSON.stringify({
						status: "canceled",
					}),
				});
			}

			return stream.writeSSE({
				data: JSON.stringify({
					status: "successful",
					documentId,
				}),
			});
		} catch (error) {
			logMemory("doc:error", reqId);
			captureError(error);

			if (error instanceof Error && error.message === "failed.format") {
				return stream.writeSSE({
					data: JSON.stringify({
						status: "failed.format",
					}),
				});
			}

			if (error instanceof Error && error.message === "failed.size") {
				return stream.writeSSE({
					data: JSON.stringify({
						status: "failed.size",
					}),
				});
			}

			// Handle Zod validation errors separately
			if (error instanceof ZodError) {
				const errors = error.issues
					.map((e) => `${e.path.join(".")}: ${e.message}`)
					.join("; ");
				return stream.writeSSE({
					data: JSON.stringify({
						status: "failed.generic",
						error: `Validation failed: ${errors}`,
					}),
				});
			}

			await cleanup({
				userScopedDbService,
				userId,
				documentId,
			});

			return stream.writeSSE({
				data: JSON.stringify({
					status: "failed.generic",
					error: "Internal Server Error",
				}),
			});
		}
	}),
);

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

async function cleanup(args: {
	userScopedDbService: UserScopedDbService;
	userId: string;
	documentId: number | null;
}) {
	const { userScopedDbService, userId, documentId } = args;

	if (documentId !== null) {
		try {
			await userScopedDbService.deleteDocument(documentId, userId);
		} catch (deleteDocumentError) {
			captureError(deleteDocumentError);
		}
	}
}

export default documents;
