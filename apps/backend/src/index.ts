import "./monitoring/instrumentation";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { sentryTracing } from "./middleware/sentry-tracing";
import basicAuth from "./middleware/basic-auth";
import documents from "./routes/documents";
import llms from "./routes/llms";
import { config, verifyConfig } from "./config";
import admin from "./routes/admin";
import { captureError } from "./monitoring/capture-error";
import { initQueues } from "./services/distributed-limiter";

verifyConfig();

const app = new Hono();

// Global middleware
app.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"x-api-key",
			"sentry-trace",
			"baggage",
		],
	}),
);

app.use("*", basicAuth);
app.use("*", sentryTracing);

// Route modules
app.route("/documents/", documents);
app.route("/llm", llms);
app.route("/admin", admin);

app.onError((error, c) => {
	captureError(error);
	return c.json({ error: "Internal Server Error" }, 500);
});

// Start server
if (require.main === module) {
	(async () => {
		try {
			await initQueues();
			serve({
				fetch: app.fetch,
				port: config.port,
			});
			/* eslint-disable-next-line no-console */
			console.info(`Server is running on port ${config.port}...`);
		} catch (error) {
			captureError(error);

			console.error("Failed to initialize queue system:", error);
			process.exit(1);
		}
	})();
}

export default app;
