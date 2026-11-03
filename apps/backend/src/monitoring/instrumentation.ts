import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { registerTelemetry } from "ai";
import * as Sentry from "@sentry/node";
import { SentryPropagator, SentrySampler } from "@sentry/opentelemetry";
import { config } from "../config";
import { redactSecretsFromEvent } from "./redact-secrets";

// Tests run with dummy Sentry and Langfuse config, so skip both.
const isTestMode = config.nodeEnv === "test";

export const sentryClient = Sentry.init({
	dsn: isTestMode ? "" : config.sentryDsn,
	environment: config.nodeEnv || "development",
	tracesSampleRate: 1.0,
	enabled: ["production", "staging"].includes(config.nodeEnv),
	skipOpenTelemetrySetup: true,
	beforeSend: redactSecretsFromEvent,
});

const sdk = new NodeSDK({
	spanProcessors: isTestMode
		? []
		: [new LangfuseSpanProcessor({ environment: config.nodeEnv })],
	sampler: sentryClient ? new SentrySampler(sentryClient) : undefined,
	contextManager: new Sentry.SentryContextManager(),
	textMapPropagator: new SentryPropagator(),
	instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
});

sdk.start();
Sentry.validateOpenTelemetrySetup();
registerTelemetry(new LangfuseVercelAiSdkIntegration());

if (config.nodeEnv === "development") {
	process.on("SIGTERM", () => process.exit(0));
}
