import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { LangfuseExporter } from "langfuse-vercel";
import { config } from "../config";
import { SentryPropagator, SentrySampler } from "@sentry/opentelemetry";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { supabase } from "../supabase";

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

const sdk = new NodeSDK({
	traceExporter: new LangfuseExporter({
		debug: false,
		environment: config.nodeEnv,
	}),
	sampler: sentryClient ? new SentrySampler(sentryClient) : undefined,
	contextManager: new Sentry.SentryContextManager(),
	textMapPropagator: new SentryPropagator(),
	instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
Sentry.validateOpenTelemetrySetup();
