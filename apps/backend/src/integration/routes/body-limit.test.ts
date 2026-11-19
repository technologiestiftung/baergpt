import { describe, it, expect, vi } from "vitest";
import app from "../../index";

vi.mock("../../middleware/basic-auth", () => ({
	default: vi.fn(
		async (c: import("hono").Context, next: () => Promise<void>) => {
			c.set("authenticatedUserId", "test-user-id");
			c.set("UserScopedDbClient", {});
			return next();
		},
	),
}));

const CHAT_URL = "http://localhost/llm/just-chatting";
const MB = 1024 * 1024;

describe("default request body limit", () => {
	it("answers 413 without reading the body when Content-Length exceeds 4 MB", async () => {
		const givenRequest = new Request(CHAT_URL, {
			method: "POST",
			headers: {
				Authorization: "Bearer mock-token",
				"Content-Type": "application/json",
				"Content-Length": String(4 * MB + 1),
			},
			body: "{}",
		});

		const actualResponse = await app.fetch(givenRequest);

		expect(actualResponse.status).toBe(413);
		expect(givenRequest.bodyUsed).toBe(false);
	});

	it("lets a request of exactly 4 MB through to the route", async () => {
		const givenRequest = new Request(CHAT_URL, {
			method: "POST",
			headers: {
				Authorization: "Bearer mock-token",
				"Content-Type": "application/json",
				"Content-Length": String(4 * MB),
			},
			body: "{}",
		});

		const actualResponse = await app.fetch(givenRequest);

		expect(actualResponse.status).toBe(400);
		expect(await actualResponse.json()).toEqual({
			error: "Invalid request: llm_model is required and must be a string",
		});
	});
});
