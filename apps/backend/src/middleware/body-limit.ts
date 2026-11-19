import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

export function limitBody(getMaxBytes: () => number): MiddlewareHandler {
	return (c, next) =>
		bodyLimit({
			maxSize: getMaxBytes(),
			onError: (errorContext) =>
				errorContext.json({ error: "Payload Too Large" }, 413),
		})(c, next);
}
