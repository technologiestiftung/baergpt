import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import type { LLMIdentifier } from "../types/common";
import { EmbeddingService } from "../services/embedding-service";
import { retryOperation, validateAndCleanBase64 } from "../utils";
import { GenerationService } from "../services/generation-service";
import { PDFDocument } from "pdf-lib";
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
		let base64Document = body.base64Document;
		const document = body.document;
		const llmIdentifier = config.defaultModelIdentifier as LLMIdentifier;

		if (
			document.file_name?.toLowerCase().endsWith(".docx") ||
			document.file_name?.toLowerCase().endsWith(".doc")
		) {
			base64Document = validateAndCleanBase64(base64Document);
		}

		const extractionResult = await dbService.logAndExtractDocument(
			document,
			base64Document,
		);
		if (!extractionResult || !extractionResult.document) {
			throw new Error("Error processing document");
		}

		const parsedPages = extractionResult.parsedPages;

		await retryOperation(() =>
			generationService.summarize(
				parsedPages,
				llmIdentifier,
				extractionResult.document,
			),
		);

		await embeddingService.batchEmbed(parsedPages, extractionResult.document, {
			chunkingTechnique: "segmenter",
		});

		await dbService.finishProcessing(extractionResult.document);

		return c.body(null, 204);
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

documents.post("/upload", async (c: Context) => {
	try {
		const body = await c.req.json();
		const { base64Document, sourceUrl, isPublicDocument } = body;
		const fileName = sourceUrl.split("/").pop() || "document";

		let fileBuffer: Uint8Array;

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

		const ext = [".pdf", ".docx", ".doc", ".xlsx"].find((e) =>
			sourceUrl.endsWith(e),
		);
		const fileType = ext ? getFileType(ext) : null;
		if (!fileType) {
			throw new Error("Unsupported file type");
		}

		if (ext === ".pdf") {
			const pdfDoc = await PDFDocument.load(base64Document);
			fileBuffer = await pdfDoc.save();
		} else {
			const cleanBase64 = validateAndCleanBase64(base64Document);

			const wordBuffer = Buffer.from(cleanBase64, "base64");
			fileBuffer = new Uint8Array(wordBuffer);

			if (sourceUrl.endsWith(".docx")) {
				// Convert DOCX to PDF for previews
				if (!wordBuffer) {
					throw new Error("Word buffer is empty");
				}
				try {
					const pdfBytes = await wordExService.convertDocxToPdf(wordBuffer);
					await dbService.uploadFileToStorage(
						sourceUrl.replace(/\.docx?$/, ".pdf"),
						new File([pdfBytes], fileName.replace(/\.docx?$/, ".pdf"), {
							type: "application/pdf",
						}),
						isPublicDocument,
					);
				} catch (error) {
					captureError(error);
				}
			}
		}

		const file = new File([fileBuffer], fileName, { type: fileType });
		await dbService.uploadFileToStorage(sourceUrl, file, isPublicDocument);

		return c.body(null, 204);
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default documents;
