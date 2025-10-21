import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { LangfuseSpanProcessor, ShouldExportSpan } from "@langfuse/otel";
import { config } from "../config";
import {
	SentryPropagator,
	SentrySampler,
	SentrySpanProcessor,
} from "@sentry/opentelemetry";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { supabase } from "../supabase";
import { configureGlobalLogger, LogLevel } from "@langfuse/core";

export const sentryClient = Sentry.init({
	dsn: config.sentryDsn || "",
	environment: config.nodeEnv || "development",
	integrations: [
		nodeProfilingIntegration(),
		Sentry.supabaseIntegration({ supabaseClient: supabase }),
	],
	tracesSampleRate: 1.0,
	profileSessionSampleRate: 1.0,
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
