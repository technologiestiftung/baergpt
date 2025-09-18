import { describe, expect, it } from "vitest";
import { emailValidationRegex as testUnit } from "./email-validation";

describe("registration email validation", async () => {
	describe("berlin.de domain", async () => {
		describe("valid emails", async () => {
			it("should accept @berlin.de emails", async () => {
				const givenEmail = "example@berlin.de";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(true);
			});

			it("should accept @subdomain.berlin.de emails", async () => {
				const givenEmail = "example@verwaltung.berlin.de";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(true);
			});
		});

		describe("invalid emails", () => {
			it("should reject @fake-berlin.de emails", async () => {
				const givenEmail = "example@fake-berlin.de";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});

			it("should reject @fake.fake-berlin.de emails", async () => {
				const givenEmail = "example@fake.fake-berlin.de";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});

			it("should reject @berlin.de-like.com", async () => {
				const givenEmail = "example@berlin.de-like.com";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});

			it("should reject @fake.berlin.de-like.com", async () => {
				const givenEmail = "example@fake.berlin.de-like.com";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});
		});
	});

	describe("ts.berlin domain", async () => {
		describe("valid emails", async () => {
			it("should accept @ts.berlin emails", async () => {
				const givenEmail = "example@ts.berlin";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(true);
			});
		});

		describe("invalid emails", async () => {
			it("should reject @fake-ts.berlin emails", async () => {
				const givenEmail = "example@fake-ts.berlin";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});

			it("should reject @ts.berlin-like.com", async () => {
				const givenEmail = "example@ts.berlin-like.com";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});
		});
	});

	describe("itdz-berlin.de domain", async () => {
		describe("valid emails", async () => {
			it("should accept @itdz-berlin.de emails", async () => {
				const givenEmail = "example@itdz-berlin.de";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(true);
			});
		});

		describe("invalid emails", async () => {
			it("should reject @fake-itdz-berlin.de emails", async () => {
				const givenEmail = "example@fake-itdz-berlin.de";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});

			it("should reject @itdz-berlin.de-like.com", async () => {
				const givenEmail = "example@itdz-berlin.de-like.com";

				const actualValue = testUnit.test(givenEmail);

				expect(actualValue).toBe(false);
			});
		});
	});
});

describe("Generally invalid emails", () => {
	it("should reject @gmail.com emails", async () => {
		const givenEmail = "example@gmail.com";

		const actualValue = testUnit.test(givenEmail);

		expect(actualValue).toBe(false);
	});

	it("should reject @outlook.com emails", async () => {
		const givenEmail = "example@outlook.com";

		const actualValue = testUnit.test(givenEmail);

		expect(actualValue).toBe(false);
	});

	it("should reject malformed emails", async () => {
		const givenEmail = "example@ts,berlin";

		const actualValue = testUnit.test(givenEmail);

		expect(actualValue).toBe(false);
	});
});
