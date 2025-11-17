import { describe, expect, it, beforeEach } from "vitest";
import {
	createEmailValidationRegex,
	getEmailValidationRegex,
	validateEmail,
	clearRegexCache,
	type DomainConfig,
} from "./email-validation";

describe("dynamic email validation regex creation", () => {
	beforeEach(() => {
		clearRegexCache(); // Clear cache between tests
	});

	describe("createEmailValidationRegex", () => {
		describe("with wildcard domain strings from database", () => {
			describe("*.berlin.de domain", () => {
				it("should reject base @berlin.de emails", () => {
					const regex = createEmailValidationRegex(["*.berlin.de"]);

					expect(regex?.test("user@berlin.de")).toBe(false);
				});

				it("should accept subdomain @subdomain.berlin.de emails", () => {
					const regex = createEmailValidationRegex(["*.berlin.de"]);

					expect(regex?.test("user@verwaltung.berlin.de")).toBe(true);
					expect(regex?.test("user@it.berlin.de")).toBe(true);
				});

				it("should reject fake berlin.de domains", () => {
					const regex = createEmailValidationRegex(["*.berlin.de"]);

					expect(regex?.test("user@fake-berlin.de")).toBe(false);
					expect(regex?.test("user@berlin.de-like.com")).toBe(false);
				});
			});

			describe("ts.berlin domain (no wildcard)", () => {
				it("should accept @ts.berlin emails", () => {
					const regex = createEmailValidationRegex(["ts.berlin"]);

					expect(regex?.test("user@ts.berlin")).toBe(true);
				});

				it("should reject subdomain @sub.ts.berlin emails", () => {
					const regex = createEmailValidationRegex(["ts.berlin"]);

					expect(regex?.test("user@sub.ts.berlin")).toBe(false);
				});

				it("should reject fake ts.berlin domains", () => {
					const regex = createEmailValidationRegex(["ts.berlin"]);

					expect(regex?.test("user@fake-ts.berlin")).toBe(false);
					expect(regex?.test("user@ts.berlin-like.com")).toBe(false);
				});
			});

			describe("berlin.de domain (no wildcard)", () => {
				it("should accept base @berlin.de emails", () => {
					const regex = createEmailValidationRegex(["berlin.de"]);

					expect(regex?.test("user@berlin.de")).toBe(true);
				});

				it("should reject subdomain @subdomain.berlin.de emails", () => {
					const regex = createEmailValidationRegex(["berlin.de"]);

					expect(regex?.test("user@verwaltung.berlin.de")).toBe(false);
				});
			});
		});

		describe("with explicit domain configurations", () => {
			it("should respect explicit subdomain settings", () => {
				const configs: DomainConfig[] = [
					{ domain: "example.com", allowSubdomains: true },
					{ domain: "test.org", allowSubdomains: false },
				];
				const regex = createEmailValidationRegex([], configs);

				expect(regex?.test("user@example.com")).toBe(false); // base domain rejected when allowSubdomains=true
				expect(regex?.test("user@sub.example.com")).toBe(true); // subdomain required
				expect(regex?.test("user@test.org")).toBe(true); // exact match accepted
				expect(regex?.test("user@sub.test.org")).toBe(false); // subdomain rejected for exact match
			});
		});

		describe("performance and caching", () => {
			it("should return the same regex instance for identical configurations", () => {
				const regex1 = createEmailValidationRegex(["*.berlin.de"]);
				const regex2 = createEmailValidationRegex(["*.berlin.de"]);

				expect(regex1).toBe(regex2); // Same instance due to caching
			});
		});

		describe("with multiple domains", () => {
			it("should create regex that accepts emails from all allowed domains", () => {
				const regex = createEmailValidationRegex([
					"*.berlin.de",
					"ts.berlin",
					"itdz-berlin.de",
				]);

				expect(regex?.test("user@berlin.de")).toBe(false); // base domain rejected for wildcard
				expect(regex?.test("user@verwaltung.berlin.de")).toBe(true);
				expect(regex?.test("user@ts.berlin")).toBe(true);
				expect(regex?.test("user@itdz-berlin.de")).toBe(true);
			});

			it("should reject emails from non-allowed domains", () => {
				const regex = createEmailValidationRegex([
					"*.berlin.de",
					"ts.berlin",
					"itdz-berlin.de",
				]);

				expect(regex?.test("user@gmail.com")).toBe(false);
				expect(regex?.test("user@outlook.com")).toBe(false);
				expect(regex?.test("user@example.com")).toBe(false);
			});
		});

		describe("with empty or invalid input", () => {
			it("should return null when no domains provided", () => {
				const regex = createEmailValidationRegex([]);

				expect(regex).toBe(null);
			});

			it("should handle special characters in domain names", () => {
				const regex = createEmailValidationRegex(["test.example-domain.org"]);

				expect(regex?.test("user@test.example-domain.org")).toBe(true);
			});
		});

		describe("improved email validation", () => {
			it("should accept more valid email characters", () => {
				const regex = createEmailValidationRegex(["*.berlin.de"]);

				expect(regex?.test("user+tag@verwaltung.berlin.de")).toBe(true);
				expect(regex?.test("user.name@it.berlin.de")).toBe(true);
				expect(regex?.test("user_name@sub.berlin.de")).toBe(true);
			});

			it("should be case insensitive", () => {
				const regex = createEmailValidationRegex(["*.berlin.de"]);

				expect(regex?.test("User@Verwaltung.Berlin.de")).toBe(true);
				expect(regex?.test("USER@IT.BERLIN.DE")).toBe(true);
				expect(regex?.test("user@sub.berlin.DE")).toBe(true);
			});
		});
	});

	describe("validateEmail", () => {
		it("should return validation result with context for wildcard domains", () => {
			const result = validateEmail("user@verwaltung.berlin.de", [
				"*.berlin.de",
			]);

			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.allowedDomains).toEqual(["*.berlin.de"]);
		});

		it("should reject base domain when wildcard is used", () => {
			const result = validateEmail("user@berlin.de", ["*.berlin.de"]);

			expect(result.isValid).toBe(false);
			expect(result.error).toBe(
				"E-Mail-Format nicht zulässig. Bei Fragen support@baergpt.berlin kontaktieren.",
			);
			expect(result.allowedDomains).toEqual(["*.berlin.de"]);
		});

		it("should return error message for invalid email", () => {
			const result = validateEmail("user@gmail.com", ["*.berlin.de"]);

			expect(result.isValid).toBe(false);
			expect(result.error).toBe(
				"E-Mail-Format nicht zulässig. Bei Fragen support@baergpt.berlin kontaktieren.",
			);
			expect(result.allowedDomains).toEqual(["*.berlin.de"]);
		});

		it("should handle no domains provided", () => {
			const result = validateEmail("user@berlin.de");

			expect(result.isValid).toBe(false);
			expect(result.error).toBe("No allowed email domains configured");
			expect(result.allowedDomains).toEqual([]);
		});

		it("should handle empty domains array", () => {
			const result = validateEmail("user@berlin.de", []);

			expect(result.isValid).toBe(false);
			expect(result.error).toBe("No allowed email domains configured");
			expect(result.allowedDomains).toEqual([]);
		});

		it("should validate against wildcard domains from database", () => {
			const result = validateEmail("user@verwaltung.berlin.de", [
				"*.berlin.de",
				"ts.berlin",
			]);

			expect(result.isValid).toBe(true);
			expect(result.allowedDomains).toEqual(["*.berlin.de", "ts.berlin"]);
		});
	});

	describe("getEmailValidationRegex", () => {
		it("should work with provided wildcard domains", () => {
			const regex = getEmailValidationRegex(["*.berlin.de"]);

			expect(regex?.test("user@verwaltung.berlin.de")).toBe(true);
			expect(regex?.test("user@berlin.de")).toBe(false);
		});

		it("should return null when no domains provided", () => {
			const regex = getEmailValidationRegex(undefined);

			expect(regex).toBe(null);
		});
	});
});
