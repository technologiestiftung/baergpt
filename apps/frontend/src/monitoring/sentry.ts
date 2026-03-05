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
import { config } from "../config.ts";

Sentry.init({
	dsn: config.sentryDsn,
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
	environment: config.env || "development",
	tracesSampleRate: 1,
	tracePropagationTargets: config.tracePropagationTargets,
	ignoreErrors: Array.from(NON_REPORTABLE_ERRORS),
	sendDefaultPii: false,
	enabled: ["production", "staging", "test"].includes(config.env),
});

// Call this AFTER Sentry.init()
export const sentryCreateBrowserRouter =
	Sentry.wrapCreateBrowserRouterV6(createBrowserRouter);
