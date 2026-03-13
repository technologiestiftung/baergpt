import { describe, expect, it, vi, beforeAll } from "vitest";
import { maxRetries } from "./constants";

vi.mock("@sentry/node", () => ({
	captureException: vi.fn(),
}));

import { resilientCall } from "./utils";
import { config } from "./config";
import { initQueues } from "./services/distributed-limiter";

describe("resilientCall()", () => {
	beforeAll(async () => {
		await initQueues();
	}, 20_000);

	describe("with retries", () => {
		it("should retry the operation on failure up to the default number of retries", async () => {
			const givenError = new Error("GivenError");
			const expectedResult = "success";

			let attempts = 0;

			const givenFunction = vi.fn(async () => {
				if (attempts < maxRetries) {
					attempts++;
					throw givenError;
				}
				return expectedResult;
			});

			const actualResult = resilientCall(givenFunction);
			const expectedAttempts = maxRetries + 1; // Initial attempt + retries

			await expect(actualResult).resolves.toBe(expectedResult);
			expect(givenFunction).toHaveBeenCalledTimes(expectedAttempts);
		});

		it("should fail after exhausting all retries", async () => {
			const givenError = new Error("PersistentError");
			const givenFunction = vi.fn(async () => {
				throw givenError;
			});

			const actualResult = resilientCall(givenFunction);
			const expectedAttempts = maxRetries + 1; // Initial attempt + retries
			await expect(actualResult).rejects.toThrow("PersistentError");
			expect(givenFunction).toHaveBeenCalledTimes(expectedAttempts);
		});
	});

	describe("Embeddings queue", () => {
		it("should throttle embeddings operations according to rate limit", async () => {
			const mockOperation = vi.fn(async () => "result");
			const startTime = Date.now();
			const amountOfCalls = config.mistralMaxRPS + 1;

			// Create multiple operations that should be throttled
			const promises = Array.from({ length: amountOfCalls }, () =>
				resilientCall(mockOperation, {
					queueType: "embeddings",
				}),
			);

			await Promise.all(promises);
			const endTime = Date.now();
			const duration = endTime - startTime;

			const expectedDuration = 900; // 0.9 second for some margin

			expect(duration).toBeGreaterThanOrEqual(expectedDuration);
			expect(mockOperation).toHaveBeenCalledTimes(amountOfCalls);
		});
	}, 20_000);

	describe("LLM queue", () => {
		it("should throttle embeddings operations according to rate limit", async () => {
			const mockOperation = vi.fn(async () => "result");
			const startTime = Date.now();
			const amountOfCalls = config.mistralMaxRPS + 1;

			// Create multiple operations that should be throttled
			const promises = Array.from({ length: amountOfCalls }, () =>
				resilientCall(mockOperation, { queueType: "llm" }),
			);

			await Promise.all(promises);
			const endTime = Date.now();
			const duration = endTime - startTime;

			const expectedDuration = 900; // 0.9 second for some margin

			expect(duration).toBeGreaterThanOrEqual(expectedDuration);
			expect(mockOperation).toHaveBeenCalledTimes(amountOfCalls);
		});
	}, 20_000);

	describe.skipIf(!config.featureFlagWebSearchAllowed)(
		"Web search queue",
		() => {
			it("should throttle web search operations according to rate limit", async () => {
				const mockOperation = vi.fn(async () => "result");
				const startTime = Date.now();
				const amountOfCalls = (config.braveSearchMaxRPS ?? 10) + 1;

				const promises = Array.from({ length: amountOfCalls }, () =>
					resilientCall(mockOperation, { queueType: "webSearch" }),
				);

				await Promise.all(promises);
				const endTime = Date.now();
				const duration = endTime - startTime;

				const expectedDuration = 900; // 0.9 second for some margin

				expect(duration).toBeGreaterThanOrEqual(expectedDuration);
				expect(mockOperation).toHaveBeenCalledTimes(amountOfCalls);
			});
		},
		20_000,
	);
});
