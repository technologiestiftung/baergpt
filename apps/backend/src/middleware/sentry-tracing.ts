import * as Sentry from "@sentry/node";
import type { MiddlewareHandler } from "hono";

export const sentryTracing: MiddlewareHandler = async (c, next) => {
	const method = c.req.method;
	const path = c.req.path;

	const sentryTrace = c.req.header("sentry-trace");
	const baggage = c.req.header("baggage");

	return await Sentry.startSpan(
		{
			name: `${method} ${path}`,
			op: "http.server",
			attributes: {
				"http.method": method,
				"http.url": c.req.url,
				"http.route": path,
			},
		},
		async () => {
			if (sentryTrace) {
				return Sentry.continueTrace(
					{ sentryTrace, baggage },
					async () => await next(),
				);
			}
			return await next();
		},
	);
};
