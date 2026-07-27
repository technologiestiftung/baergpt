import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock fns so we can reference them inside vi.mock and assert on them
const { uploadMock, ocrProcessMock, deleteMock } = vi.hoisted(() => ({
	uploadMock: vi.fn(),
	ocrProcessMock: vi.fn(),
	deleteMock: vi.fn(),
}));

vi.mock("@mistralai/mistralai", () => ({
	Mistral: vi.fn().mockImplementation(() => ({
		files: {
			upload: uploadMock,
			delete: deleteMock,
		},
		ocr: {
			process: ocrProcessMock,
		},
	})),
}));

vi.mock("../monitoring/capture-error", () => ({
	captureError: vi.fn(),
}));

import {
	DocumentExtractionService,
	MistralOCRService,
} from "../services/document-extraction-service";
import { captureError } from "../monitoring/capture-error";
import type { Document } from "../types/common";

describe("MistralOCRService cleanup on OCR failure", () => {
	const captureErrorMock = captureError as ReturnType<typeof vi.fn>;
	const service = new DocumentExtractionService();
	const givenPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"

	beforeEach(() => {
		vi.clearAllMocks();
		// Exercise the real extraction logic instead of the NODE_ENV=test static mocks
		vi.spyOn(
			MistralOCRService.prototype,
			"shouldMockExternalServices",
		).mockReturnValue(false);
		uploadMock.mockResolvedValue({ id: "uploaded-file-id" });
		deleteMock.mockResolvedValue(undefined);
	});

	it("deletes the uploaded file after a successful OCR extraction", async () => {
		ocrProcessMock.mockResolvedValueOnce({
			pages: [{ markdown: "# Page one" }, { markdown: "Page two content" }],
		});

		const actualPages = await service.extractPdfAsMarkdownPages(givenPdfBytes);

		// The extraction succeeds and returns one ParsedPage per OCR page
		expect(actualPages).toHaveLength(2);
		expect(actualPages[0]).toMatchObject({
			content: "# Page one",
			pageNumber: 1,
		});
		expect(actualPages[1]).toMatchObject({
			content: "Page two content",
			pageNumber: 2,
		});

		// Cleanup still runs on the happy path
		expect(deleteMock).toHaveBeenCalledOnce();
		expect(deleteMock).toHaveBeenCalledWith({ fileId: "uploaded-file-id" });

		// No errors should be captured when everything works
		expect(captureErrorMock).not.toHaveBeenCalled();
	});

	it("deletes the uploaded file even when ocr.process throws", async () => {
		const givenOcrError = new Error("OCR processing failed");
		ocrProcessMock.mockRejectedValueOnce(givenOcrError);

		await expect(
			service.extractPdfAsMarkdownPages(givenPdfBytes),
		).rejects.toThrow(givenOcrError);

		// The fix: cleanup runs in `finally`, so delete is still called
		expect(deleteMock).toHaveBeenCalledOnce();
		expect(deleteMock).toHaveBeenCalledWith({ fileId: "uploaded-file-id" });
	});

	it("deletes the uploaded file even when the OCR response has no pages", async () => {
		ocrProcessMock.mockResolvedValueOnce({ pages: [] });

		await expect(
			service.extractPdfAsMarkdownPages(givenPdfBytes),
		).rejects.toThrow("No pages found in OCR response");

		expect(deleteMock).toHaveBeenCalledOnce();
		expect(deleteMock).toHaveBeenCalledWith({ fileId: "uploaded-file-id" });
	});

	it("does not capture a 404 when deleting an already-removed file", async () => {
		ocrProcessMock.mockRejectedValueOnce(new Error("OCR processing failed"));
		deleteMock.mockRejectedValueOnce({ statusCode: 404 });

		await expect(
			service.extractPdfAsMarkdownPages(givenPdfBytes),
		).rejects.toThrow("OCR processing failed");

		expect(deleteMock).toHaveBeenCalledOnce();
		// 404 on delete is benign and must NOT be reported
		expect(captureErrorMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ statusCode: 404 }),
		);
	});

	it("captures a non-404 delete failure without masking the OCR error", async () => {
		const givenOcrError = new Error("OCR processing failed");
		const givenDeleteError = { statusCode: 500, message: "delete failed" };
		ocrProcessMock.mockRejectedValueOnce(givenOcrError);
		deleteMock.mockRejectedValueOnce(givenDeleteError);

		// The original OCR error must still propagate (finally must not swallow it)
		await expect(
			service.extractPdfAsMarkdownPages(givenPdfBytes),
		).rejects.toThrow(givenOcrError);

		expect(deleteMock).toHaveBeenCalledOnce();
		expect(captureErrorMock).toHaveBeenCalledWith(givenDeleteError);
	});
});

describe("DocumentExtractionService CSV extraction", () => {
	const service = new DocumentExtractionService();

	it("extracts a CSV file into a Markdown table", async () => {
		const csvText = "Name,Age,City\nAlice,30,Berlin\nBob,25,Hamburg";
		const csvBytes = new TextEncoder().encode(csvText);
		const document: Document = {
			id: 1,
			source_url: "user-123/data.csv",
			source_type: "personal_document",
			created_at: new Date().toISOString(),
		};

		const result = await service.extractDocument(csvBytes, document);

		expect(result.numPages).toBe(1);
		expect(result.parsedPages).toHaveLength(1);
		expect(result.parsedPages[0].content).toContain("| Name | Age | City |");
		expect(result.parsedPages[0].content).toContain("| Alice | 30 | Berlin |");
		expect(result.parsedPages[0].content).toContain("| Bob | 25 | Hamburg |");
	});
});
