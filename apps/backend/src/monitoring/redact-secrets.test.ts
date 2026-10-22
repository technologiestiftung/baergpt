import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { redactRequestBody, redactSecretsFromEvent } from "./redact-secrets";

describe("redactRequestBody", () => {
	it("redacts the integration key in a JSON string body", () => {
		expect(redactRequestBody('{"key":"dw-secret-123"}')).toBe(
			'{"key":"[Redacted]"}',
		);
	});

	it("redacts nested key fields and keeps other fields", () => {
		const body = JSON.stringify({
			chatId: 42,
			nested: { key: "k1" },
			items: [{ key: "k2" }],
		});

		expect(JSON.parse(redactRequestBody(body) as string)).toEqual({
			chatId: 42,
			nested: { key: "[Redacted]" },
			items: [{ key: "[Redacted]" }],
		});
	});

	it("redacts object bodies", () => {
		expect(redactRequestBody({ key: "dw-secret-123", other: "x" })).toEqual({
			key: "[Redacted]",
			other: "x",
		});
	});

	it("redacts a truncated JSON body that mentions a secret field entirely", () => {
		expect(redactRequestBody('{"key":"dw-secret-1')).toBe("[Redacted]");
	});

	it("keeps non-JSON bodies without secret fields", () => {
		expect(redactRequestBody("plain text")).toBe("plain text");
	});
});

describe("redactSecretsFromEvent", () => {
	it("redacts request.data and leaves the rest of the event untouched", () => {
		const event = {
			type: undefined,
			request: {
				url: "http://localhost/integrations/datawrapper/key",
				method: "PUT",
				data: '{"key":"dw-secret-123"}',
			},
		} as ErrorEvent;

		expect(redactSecretsFromEvent(event).request).toEqual({
			url: "http://localhost/integrations/datawrapper/key",
			method: "PUT",
			data: '{"key":"[Redacted]"}',
		});
	});
});
