import "./monitoring/instrumentation";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { except } from "hono/combine";
import { sentryTracing } from "./middleware/sentry-tracing";
import basicAuth from "./middleware/basic-auth";
import { limitBody } from "./middleware/body-limit";
import documents from "./routes/documents";
import llms from "./routes/llms";
import { config, verifyConfig } from "./config";
import admin from "./routes/admin";
import favicon from "./routes/favicon";
import integrations from "./routes/integrations";
import { captureError } from "./monitoring/capture-error";
import { logMemory } from "./monitoring/memory-logger";
import { configureAiSdkWarnings } from "./monitoring/ai-sdk-warnings";

verifyConfig();
configureAiSdkWarnings();

const DEFAULT_BODY_LIMIT_BYTES = 4 * 1024 * 1024;

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

// Unauthenticated liveness probe for Docker/CF health checks
app.get("/health", (c) => c.json({ status: "ok" }));

app.use("*", sentryTracing);

app.use("*", basicAuth);

app.use(
	"*",
	except(
		"/documents/process",
		limitBody(() => DEFAULT_BODY_LIMIT_BYTES),
	),
);

// Route modules
app.route("/documents", documents);
app.route("/favicon", favicon);
app.route("/llm", llms);
app.route("/admin", admin);
app.route("/integrations", integrations);

app.onError((error, c) => {
	captureError(error);
	return c.json({ error: "Internal Server Error" }, 500);
});

// Start server
if (require.main === module) {
	(async () => {
		try {
			serve({
				fetch: app.fetch,
				port: config.port,
			});
			/* eslint-disable-next-line no-console */
			console.info(`Server is running on port ${config.port}...`);
			const memoryLogInterval = setInterval(
				() => logMemory("periodic"),
				30_000,
			);
			process.on("SIGTERM", () => clearInterval(memoryLogInterval));
		} catch (error) {
			captureError(error);
			process.exit(1);
		}
	})();
}

export default app;
