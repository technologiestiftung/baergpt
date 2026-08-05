import { describe, it, expect } from "vitest";
import { deriveLegacyPreviewSourceUrl } from "./get-document-object-url";

describe("deriveLegacyPreviewSourceUrl", () => {
	it("swaps a .docx suffix for .pdf", () => {
		expect(deriveLegacyPreviewSourceUrl("user-1/report.docx")).toBe(
			"user-1/report.pdf",
		);
	});

	it("leaves non-docx source urls unchanged", () => {
		expect(deriveLegacyPreviewSourceUrl("user-1/report.pdf")).toBe(
			"user-1/report.pdf",
		);
	});

	it("is case-insensitive on the .docx suffix", () => {
		expect(deriveLegacyPreviewSourceUrl("user-1/report.DOCX")).toBe(
			"user-1/report.pdf",
		);
	});
});
