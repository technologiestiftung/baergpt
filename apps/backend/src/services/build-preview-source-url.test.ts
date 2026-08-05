import { describe, expect, it } from "vitest";
import { buildPreviewSourceUrl } from "./build-preview-source-url";

const UUID_PDF_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

describe("buildPreviewSourceUrl", () => {
	it("keeps the original directory but replaces the filename with a UUID-based .pdf name", () => {
		const result = buildPreviewSourceUrl("user-123/folder-456/report.docx");

		const segments = result.split("/");
		const fileName = segments.pop() as string;
		expect(segments.join("/")).toBe("user-123/folder-456");
		expect(fileName).toMatch(UUID_PDF_PATTERN);
	});

	it("does not derive the name from the original filename", () => {
		const result = buildPreviewSourceUrl("user-123/report.docx");

		expect(result).not.toContain("report");
	});

	it("generates a different name on each call, so repeated conversions of the same document never collide", () => {
		const first = buildPreviewSourceUrl("user-123/report.docx");
		const second = buildPreviewSourceUrl("user-123/report.docx");

		expect(first).not.toBe(second);
	});

	it("handles a source_url with no directory prefix", () => {
		const result = buildPreviewSourceUrl("report.docx");

		expect(result).toMatch(UUID_PDF_PATTERN);
	});
});
