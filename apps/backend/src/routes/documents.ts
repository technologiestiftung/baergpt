import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import type { LLMIdentifier } from "../types/common";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { WordDocumentExtractionService } from "../services/document-extraction-service";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";

// Temporary memory instrumentation helper
const mem = (label: string) => {
	const m = process.memoryUsage();
	// Keep logs concise but informative
	console.log(
		`[mem] ${label} rss=${(m.rss / 1024 / 1024).toFixed(1)}MB heapUsed=${(
			m.heapUsed / 1024 / 1024
		).toFixed(1)}MB`,
	);
};

const documents = new Hono();
const dbService = new DatabaseService();
const wordExService = new WordDocumentExtractionService();
const embeddingService = new EmbeddingService();
const generationService = new GenerationService();

documents.post("/process", async (c: Context) => {
	try {
		mem("process:before-json");
		const body = await c.req.json();
		mem("process:after-json");
		const { document } = body;
		const llmIdentifier = config.defaultModelIdentifier as LLMIdentifier;
		mem("process:before-logAndExtractDocument");
		let extractionResult = await dbService.logAndExtractDocument(document);
		mem("process:after-logAndExtractDocument");
		const extractedDocument = extractionResult.document;

		let parsedPages = extractionResult.parsedPages;
		mem("process:before-summarize+embed");
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
		mem("process:after-summarize+embed");
		
		// Clear large objects after processing
		parsedPages = null;
		extractionResult = null;

		await dbService.finishProcessing(extractedDocument);
		mem("process:after-finishProcessing");
		try {
			// Attempt to clear references and trigger GC
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			global.gc?.();
			mem("process:after-gc");
		} catch {}
		return c.body(null, 204);
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

documents.post("/upload", async (c: Context) => {
	try {
		mem("before-parseBody");
		const body = await c.req.parseBody();
		mem("after-parseBody");
		const uploadedFile = body["file"];
		const sourceUrl = String(body["sourceUrl"] || "");
		const isPublicDocument = body["isPublicDocument"] === "true";
		if (!(uploadedFile instanceof File)) {
			return c.json({ error: "No file" }, 400);
		}
		const fileName = uploadedFile.name || "document";
		try {
			// Log file size if available (in MB)
			const sizeMb =
				typeof uploadedFile?.size === "number"
					? (uploadedFile.size / 1024 / 1024).toFixed(1)
					: "n/a";
			console.log(`[upload] file=${fileName} size=${sizeMb}MB`);
		} catch {}

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

		mem("before-upload");
		await dbService.uploadFileToStorage(
			sourceUrl,
			uploadedFile,
			isPublicDocument,
		);
		mem("after-upload");
		try {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			global.gc?.();
			mem("after-gc");
		} catch {}

		if (/\.(docx)$/i.test(fileName)) {
			try {
				let wordBuffer = new Uint8Array(await uploadedFile.arrayBuffer());
				let pdfBytes = await wordExService.convertDocxToPdf(
					Buffer.from(wordBuffer),
				);

				wordBuffer = null;
				
				await dbService.uploadFileToStorage(
					sourceUrl.replace(/\.docx?$/i, ".pdf"),
					new File([pdfBytes], fileName.replace(/\.docx?$/i, ".pdf"), {
						type: "application/pdf",
					}),
					isPublicDocument,
				);
				
				pdfBytes = null;
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
