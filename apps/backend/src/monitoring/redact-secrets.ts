import type { ErrorEvent } from "@sentry/node";

const REDACTED = "[Redacted]";

/**
 * Request body fields holding secrets to be filtered out for observability:
 * - key: the integration API key in PUT /integrations/:provider/key
 * (to be extended once needed)
 */
const SECRET_FIELDS = new Set(["key"]);

const isSecretField = (field: string) => SECRET_FIELDS.has(field);

function redactValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactValue);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([field, fieldValue]) => [
				field,
				isSecretField(field) ? REDACTED : redactValue(fieldValue),
			]),
		);
	}
	return value;
}

/**
 * Sentry attaches incoming request bodies (as raw string, truncated at 10 KB)
 * to error events. Keep the body for forensics but redact secret fields.
 */
export function redactRequestBody(data: unknown): unknown {
	if (typeof data !== "string") {
		return redactValue(data);
	}

	try {
		return JSON.stringify(redactValue(JSON.parse(data)));
	} catch {
		// Truncated or non-JSON body: secret fields can't be redacted reliably
		const mentionsSecretField = [...SECRET_FIELDS].some((field) =>
			data.includes(`"${field}"`),
		);
		return mentionsSecretField ? REDACTED : data;
	}
}

export function redactSecretsFromEvent(event: ErrorEvent): ErrorEvent {
	if (event.request?.data !== undefined) {
		event.request.data = redactRequestBody(event.request.data);
	}
	return event;
}
