import v8 from "node:v8";

const heapStats = v8.getHeapStatistics();

/* eslint-disable-next-line no-console */
console.info("[STARTUP] Memory config", {
	nodeOptions: process.env.NODE_OPTIONS ?? "(none)",
	memoryLimitEnv: process.env.MEMORY_LIMIT ?? "(none)",
	execArgv: process.execArgv, // shows args passed directly to `node`, e.g. via CMD
	v8HeapSizeLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
	v8TotalAvailableSizeMB: Math.round(
		heapStats.total_available_size / 1024 / 1024,
	),
});

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
import auth from "./routes/auth";
import favicon from "./routes/favicon";
import { captureError } from "./monitoring/capture-error";
import { logMemory } from "./monitoring/memory-logger";

logMemory("boot:start");

verifyConfig();

logMemory("boot:after-config");

// Catch async errors that escape the synchronous try/catch around serve()
// (e.g. OTel/Sentry SDK init, unhandled rejections, server bind errors).
process.on("uncaughtException", (error) => {
	captureError(error);
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	captureError(reason);
	process.exit(1);
});

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

app.route("/auth", auth);

app.use("*", basicAuth);

// Route modules
app.route("/documents", documents);
app.route("/favicon", favicon);
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
			const server = serve(
				{
					fetch: app.fetch,
					port: config.port,
				},
				(info) => {
					/* eslint-disable-next-line no-console */
					console.info(`Server is running on port ${info.port}...`);
					logMemory("boot:ready");
				},
			);

			// serve() binds the port asynchronously, so a bind failure
			// (e.g. EADDRINUSE) is emitted here as an 'error' event AFTER
			// serve() returns — the surrounding try/catch cannot see it.
			server.on("error", (error) => {
				captureError(error);
				process.exit(1);
			});

			const memoryLogInterval = setInterval(
				() => logMemory("periodic"),
				30_000,
			);
			process.on("SIGTERM", () => {
				clearInterval(memoryLogInterval);

				server.close((error) => {
					if (error) {
						captureError(error);
					}
					process.exit(error ? 1 : 0);
				});

				// Safety net: force-exit if close() hangs (e.g. lingering keep-alive sockets)
				setTimeout(() => {
					captureError(
						new Error("server did not close after SIGTERM, force killing"),
					);
					process.exit(1);
				}, 8_000).unref();
			});
		} catch (error) {
			captureError(error);
			process.exit(1);
		}
	})();
}

export default app;
