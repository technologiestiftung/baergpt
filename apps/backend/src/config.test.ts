import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyConfig } from "./config";

describe("verifyConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it.each(["abc", '"10"', "0", "-5"])(
		"refuses to start with UPLOAD_FILE_SIZE_LIMIT_MB=%s",
		(givenValue) => {
			vi.stubEnv("UPLOAD_FILE_SIZE_LIMIT_MB", givenValue);

			expect(() => verifyConfig()).toThrow(
				"UPLOAD_FILE_SIZE_LIMIT_MB must be a positive integer",
			);
		},
	);

	it("starts with a numeric UPLOAD_FILE_SIZE_LIMIT_MB", () => {
		vi.stubEnv("UPLOAD_FILE_SIZE_LIMIT_MB", "10");

		expect(() => verifyConfig()).not.toThrow();
	});
});
