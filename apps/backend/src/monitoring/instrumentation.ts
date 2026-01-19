import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { LangfuseSpanProcessor, ShouldExportSpan } from "@langfuse/otel";
import * as Sentry from "@sentry/node";
import { SentryPropagator, SentrySampler } from "@sentry/opentelemetry";
import { config } from "../config";

export const sentryClient = Sentry.init({
	dsn: config.sentryDsn || "",
	environment: config.nodeEnv || "development",
	tracesSampleRate: 1.0,
	enabled: ["production", "staging", "test"].includes(config.nodeEnv),
	skipOpenTelemetrySetup: true,
});

const shouldExportSpan: ShouldExportSpan = ({ otelSpan }) =>
	["langfuse-sdk", "ai"].includes(otelSpan.instrumentationScope.name);

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
	environment: config.nodeEnv,
	shouldExportSpan: shouldExportSpan,
});

const sdk = new NodeSDK({
	spanProcessors: [langfuseSpanProcessor],
	sampler: sentryClient ? new SentrySampler(sentryClient) : undefined,
	contextManager: new Sentry.SentryContextManager(),
	textMapPropagator: new SentryPropagator(),
	instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
Sentry.validateOpenTelemetrySetup();
