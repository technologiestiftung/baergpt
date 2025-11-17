import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { WordDocumentExtractionService } from "../services/document-extraction-service";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";

const documents = new Hono();
const dbService = new DatabaseService();
const wordExService = new WordDocumentExtractionService();
const embeddingService = new EmbeddingService();
const generationService = new GenerationService();

documents.post("/process", async (c: Context) => {
	try {
		const body = await c.req.json();
		const { document } = body;
		const llmIdentifier = config.defaultModelIdentifier;
		const extractionResult = await dbService.logAndExtractDocument(document);
		const extractedDocument = extractionResult.document;

		const parsedPages = extractionResult.parsedPages;
		await Promise.all([
			generationService.summarize(
				parsedPages,
				llmIdentifier,
				extractedDocument,
			),
			embeddingService.batchEmbed(parsedPages, extractedDocument, {
				chunkingTechnique: "markdown",
			}),
		]);

		await dbService.finishProcessing(extractedDocument);
		return c.body(null, 204);
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

documents.post("/upload", async (c: Context) => {
	try {
		const body = await c.req.parseBody();
		const uploadedFile = body["file"];
		const sourceUrl = String(body["sourceUrl"] || "");
		const isPublicDocument = body["isPublicDocument"] === "true";
		if (!(uploadedFile instanceof File)) {
			return c.json({ error: "No file" }, 400);
		}
		const fileName = uploadedFile.name || "document";

		const getFileType = (ext: string) => {
			switch (ext) {
				case ".pdf":
					return "application/pdf";
				case ".doc":
					return "application/msword";
				case ".docx":
					return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
				case ".xlsx":
					return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
				default:
					return null;
			}
		};

		const ext = [".pdf", ".docx", ".doc", ".xlsx"].find((extension) =>
			sourceUrl.endsWith(extension),
		);

		const fileType = ext ? getFileType(ext) : null;
		if (!fileType) {
			throw new Error("Unsupported file type");
		}

		await dbService.uploadFileToStorage(
			sourceUrl,
			uploadedFile,
			isPublicDocument,
		);

		if (/\.(docx)$/i.test(fileName)) {
			try {
				const wordBuffer = new Uint8Array(await uploadedFile.arrayBuffer());
				const pdfBytes = await wordExService.convertDocxToPdf(
					Buffer.from(wordBuffer),
				);
				await dbService.uploadFileToStorage(
					sourceUrl.replace(/\.docx?$/i, ".pdf"),
					new File([pdfBytes], fileName.replace(/\.docx?$/i, ".pdf"), {
						type: "application/pdf",
					}),
					isPublicDocument,
				);
			} catch (err) {
				captureError(err);
			}
		}
		return c.body(null, 204);
	} catch (error) {
		captureError(error);
		console.error("Upload error:", error);
		return c.json(
			{
				error: "Failed to upload file",
				message: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

export default documents;
