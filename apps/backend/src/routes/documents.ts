import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import type { LLMIdentifier } from "../types/common";
import { EmbeddingService } from "../services/embedding-service";
import { GenerationService } from "../services/generation-service";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";

const documents = new Hono();
const dbService = new DatabaseService();
const embeddingService = new EmbeddingService();
const generationService = new GenerationService();

documents.post("/process", async (c: Context) => {
	try {
		const body = await c.req.json();
		const { document } = body;

		const llmIdentifier = config.defaultModelIdentifier as LLMIdentifier;
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

export default documents;
