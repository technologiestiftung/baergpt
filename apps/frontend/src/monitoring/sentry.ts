import React from "react";
import * as Sentry from "@sentry/react";
import { supabase } from "../../supabase-client.ts";
import {
	createBrowserRouter,
	createRoutesFromChildren,
	matchRoutes,
	useLocation,
	useNavigationType,
} from "react-router-dom";
import { NON_REPORTABLE_ERRORS } from "./capture-error.ts";

Sentry.init({
	dsn: import.meta.env.VITE_SENTRY_DSN,
	integrations: [
		Sentry.reactRouterV6BrowserTracingIntegration({
			useEffect: React.useEffect,
			useLocation,
			useNavigationType,
			createRoutesFromChildren,
			matchRoutes,
		}),
		Sentry.supabaseIntegration({ supabaseClient: supabase }),
		Sentry.consoleLoggingIntegration({
			levels: ["trace", "debug", "assert", "log", "info", "warn", "error"],
		}),
	],
	enableLogs: true,
	environment: import.meta.env.VITE_VERCEL_ENV || "development",
	tracesSampleRate: 1,
	tracePropagationTargets: import.meta.env.VITE_TRACE_PROPAGATION_TARGETS.split(
		",",
	),
	ignoreErrors: Array.from(NON_REPORTABLE_ERRORS),
	sendDefaultPii: false,
	enabled: ["production", "staging", "test"].includes(
		import.meta.env.VITE_VERCEL_ENV,
	),
});

// Call this AFTER Sentry.init()
export const sentryCreateBrowserRouter =
	Sentry.wrapCreateBrowserRouterV6(createBrowserRouter);
