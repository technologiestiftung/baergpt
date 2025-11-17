import { Hono } from "hono";
import type { Context } from "hono";
import { DatabaseService } from "../services/database-service";
import { captureError } from "../monitoring/capture-error";

const documents = new Hono();
const dbService = new DatabaseService();

documents.post("/process", async (c: Context) => {
	try {
		const body = await c.req.json();
		const { document } = body;

		await dbService.processDocument(document);
		return c.body(null, 204);
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default documents;
