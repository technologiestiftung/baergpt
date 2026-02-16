import * as Sentry from "@sentry/react";
import { supabase } from "../../supabase-client.ts";
import { NON_REPORTABLE_ERRORS } from "./capture-error.ts";

Sentry.init({
	dsn: `${import.meta.env.VITE_SENTRY_DSN}`,
	integrations: [
		Sentry.browserTracingIntegration(),
		Sentry.supabaseIntegration({ supabaseClient: supabase }),
	],
	environment: import.meta.env.VITE_VERCEL_ENV || "development",
	tracesSampleRate: 0,
	tracePropagationTargets: import.meta.env.VITE_TRACE_PROPAGATION_TARGETS.split(
		",",
	),
	ignoreErrors: Array.from(NON_REPORTABLE_ERRORS),
	sendDefaultPii: false,
	enabled: ["production", "staging", "test"].includes(
		import.meta.env.VITE_VERCEL_ENV,
	),
});
