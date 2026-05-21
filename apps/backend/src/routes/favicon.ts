import { Hono } from "hono";
import type { Context } from "hono";
import { captureError } from "../monitoring/capture-error";

const favicon = new Hono();

favicon.get("/", async (c: Context) => {
	const domain = c.req.query("domain");

	if (!domain) {
		return c.json({ error: "Invalid domain" }, 400);
	}

	try {
		const response = await fetch(
			`https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
		);

		if (!response.ok) {
			captureError(new Error(`Failed to fetch favicon for domain: ${domain}`));
			return c.json({ error: "Failed to fetch favicon" }, 502);
		}

		const contentType = response.headers.get("Content-Type") ?? "image/png";
		const data = await response.arrayBuffer();

		return c.body(data, 200, {
			"Content-Type": contentType,
			"Cache-Control": "max-age=86400",
		});
	} catch (error) {
		captureError(error);
		return c.json({ error: "Failed to fetch favicon" }, 502);
	}
});

export default favicon;
