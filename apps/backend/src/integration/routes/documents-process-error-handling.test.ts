import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import app from "../../index";

vi.mock("../../monitoring/capture-error", () => ({
	captureError: vi.fn(),
}));

const mockClient = {
	from: vi.fn(),
	insert: vi.fn(),
	select: vi.fn(),
	delete: vi.fn(),
	eq: vi.fn(),
	single: vi.fn(),
};

vi.mock("../../middleware/basic-auth", () => ({
	default: vi.fn(
		async (c: import("hono").Context, next: () => Promise<void>) => {
			c.set("authenticatedUserId", "test-user-id");
			c.set("UserScopedDbClient", mockClient);
			return next();
		},
	),
}));

import { captureError } from "../../monitoring/capture-error";
import { UserScopedDbService } from "../../services/db-service/user-scoped-db-service";
import { ValidationService } from "../../services/validation-service";
import { GenerationService } from "../../services/generation-service";
import { EmbeddingService } from "../../services/embedding-service";
import {
	DocumentExtractionService,
	ExcelExtractionService,
	WordDocumentExtractionService,
} from "../../services/document-extraction-service";
import { ExtractionResult } from "../../types/common";

const BASE_URL = "http://localhost/documents/process";

const VALID_PDF_BODY = {
	document: {
		source_url: "test-user-id/some-document.pdf",
		source_type: "personal_document",
		folder_id: null,
	},
	llm_model: "mistral-small-latest",
};

const VALID_WORD_BODY = {
	document: {
		source_url: "test-user-id/some-document.docx",
		source_type: "personal_document",
		folder_id: null,
	},
	llm_model: "mistral-small-latest",
};

const VALID_EXCEL_BODY = {
	document: {
		source_url: "test-user-id/some-document.xlsx",
		source_type: "personal_document",
		folder_id: null,
	},
	llm_model: "mistral-small-latest",
};

function createRequest(body: unknown): Request {
	return new Request(BASE_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer mock-token",
		},
		body: JSON.stringify(body),
	});
}

/** A minimal extraction result so the happy-path stubs pass validation */
const MOCK_EXTRACTION_RESULT = {
	parsedPages: [{ content: "page content", tokenCount: 10, pageNumber: 1 }],
	checksum: "abc123",
	fileSize: 1234,
	numPages: 1,
} as ExtractionResult;

const MOCK_SUMMARY_DATA = {
	summary: "A summary",
	shortSummary: "Short",
	tags: ["tag"],
	summaryEmbedding: [0.1, 0.2],
};

const MOCK_EMBEDDINGS = [
	{ content: "chunk", embedding: [0.1], chunkIndex: 0, page: 1 },
];

describe("POST /documents/process – captureError is called for every error case", () => {
	const captureErrorMock = captureError as ReturnType<typeof vi.fn>;

	// Spies that represent the happy-path baseline; individual tests override them
	let validateDocumentRequestSpy: ReturnType<typeof vi.spyOn>;
	let extractDocumentSpy: ReturnType<typeof vi.spyOn>;
	let extractWordDocumentSpy: ReturnType<typeof vi.spyOn>;
	let summarizeSpy: ReturnType<typeof vi.spyOn>;
	let batchEmbedSpy: ReturnType<typeof vi.spyOn>;
	let logProcessedDocumentSpy: ReturnType<typeof vi.spyOn>;
	let deleteFileFromStorageSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Default: happy-path stubs for all service methods
		validateDocumentRequestSpy = vi
			.spyOn(ValidationService.prototype, "validateDocumentRequest")
			.mockResolvedValue({ success: true, bucket: "documents" });

		extractDocumentSpy = vi
			.spyOn(UserScopedDbService.prototype, "extractDocument")
			.mockResolvedValue(MOCK_EXTRACTION_RESULT as never);

		extractWordDocumentSpy = vi
			.spyOn(WordDocumentExtractionService.prototype, "extractWordDocument")
			.mockResolvedValue("mock extracted text");

		summarizeSpy = vi
			.spyOn(GenerationService.prototype, "summarize")
			.mockResolvedValue(MOCK_SUMMARY_DATA);

		batchEmbedSpy = vi
			.spyOn(EmbeddingService.prototype, "batchEmbed")
			.mockResolvedValue(MOCK_EMBEDDINGS as never);

		logProcessedDocumentSpy = vi
			.spyOn(UserScopedDbService.prototype, "logProcessedDocument")
			.mockResolvedValue(undefined);

		deleteFileFromStorageSpy = vi
			.spyOn(UserScopedDbService.prototype, "deleteFileFromStorage")
			.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("calls captureError when request body is not valid JSON", async () => {
		const givenRequest = new Request(BASE_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer mock-token",
			},
			body: "{ not json !!!",
		});

		const actualResponse = await app.fetch(givenRequest);

		expect(actualResponse.status).toBe(500);
		expect(captureErrorMock).toHaveBeenCalledOnce();
	});

	it("calls captureError when the request body fails Zod validation", async () => {
		const givenRequest = createRequest({
			document: {
				source_url: "", // fails the min(1) constraint
				source_type: "personal_document",
			},
			// llm_model missing
		});

		const actualResponse = await app.fetch(givenRequest);

		expect(actualResponse.status).toBe(400);
		expect(captureErrorMock).toHaveBeenCalledOnce();
		const [capturedArg] = captureErrorMock.mock.calls[0];
		expect(capturedArg.name).toBe("ZodError");
	});

	it("calls captureError when validateDocumentRequest returns a failure result", async () => {
		validateDocumentRequestSpy.mockResolvedValue({
			success: false,
			error: "File not found in storage at the specified source_url",
			status: 404,
		});

		const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

		expect(actualResponse.status).toBe(404);
		expect(captureErrorMock).toHaveBeenCalledOnce();
		const [capturedArg] = captureErrorMock.mock.calls[0];
		expect(capturedArg).toBeInstanceOf(Error);
		expect(capturedArg.message).toContain("File not found");
	});

	it("calls captureError when validateDocumentRequest throws", async () => {
		const givenError = new Error("Unexpected DB error during validation");
		validateDocumentRequestSpy.mockRejectedValue(givenError);

		const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

		expect(actualResponse.status).toBe(500);
		expect(captureErrorMock).toHaveBeenCalledOnce();
		expect(captureErrorMock).toHaveBeenCalledWith(givenError);
	});

	describe("extractDocument() errors", () => {
		let givenPdfRequest: Request;
		let givenWordRequest: Request;
		let givenExcelRequest: Request;

		beforeEach(() => {
			givenPdfRequest = createRequest(VALID_PDF_BODY);
			givenWordRequest = createRequest(VALID_WORD_BODY);
			givenExcelRequest = createRequest(VALID_EXCEL_BODY);
			// For these tests, we want to test sub-functions of extractDocument,
			// so we restore the original implementation of extractDocument
			extractDocumentSpy.mockRestore();
		});

		it("calls captureError when getDocumentBufferFromSupabase throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				UserScopedDbService.prototype,
				"getDocumentBufferFromSupabase",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenPdfRequest);

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when savePdfPreview throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				UserScopedDbService.prototype,
				"savePdfPreview",
			).mockRejectedValue(givenError);
			vi.spyOn(
				UserScopedDbService.prototype,
				"getDocumentBufferFromSupabase",
			).mockResolvedValueOnce(new Uint8Array() as never);

			const res = await app.fetch(givenWordRequest);

			expect(res.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when extractWordDocument throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				UserScopedDbService.prototype,
				"getDocumentBufferFromSupabase",
			).mockResolvedValueOnce(new Uint8Array() as never);
			vi.spyOn(
				UserScopedDbService.prototype,
				"savePdfPreview",
			).mockResolvedValueOnce();
			extractWordDocumentSpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenWordRequest);

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when extractExcelDocument throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				UserScopedDbService.prototype,
				"getDocumentBufferFromSupabase",
			).mockResolvedValueOnce(new Uint8Array() as never);
			vi.spyOn(
				ExcelExtractionService.prototype,
				"extractExcelDocument",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenExcelRequest);

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when getPdfPageCount throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				UserScopedDbService.prototype,
				"getDocumentBufferFromSupabase",
			).mockResolvedValueOnce(new Uint8Array() as never);
			vi.spyOn(
				DocumentExtractionService.prototype,
				"getPdfPageCount",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenPdfRequest);

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when extractPdfAsMarkdownPages throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				UserScopedDbService.prototype,
				"getDocumentBufferFromSupabase",
			).mockResolvedValueOnce(new Uint8Array() as never);
			vi.spyOn(
				DocumentExtractionService.prototype,
				"getPdfPageCount",
			).mockResolvedValueOnce(123);
			vi.spyOn(
				DocumentExtractionService.prototype,
				"extractPdfAsMarkdownPages",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenPdfRequest);

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});
	});

	describe("summarize() errors", () => {
		let getSummaryInputSpy: ReturnType<typeof vi.spyOn>;
		let generateSummarySpy: ReturnType<typeof vi.spyOn>;
		let generateOneSentenceSummarySpy: ReturnType<typeof vi.spyOn>;
		let generateTagsSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			getSummaryInputSpy = vi.spyOn(
				GenerationService.prototype,
				"getSummaryInput",
			);
			generateSummarySpy = vi.spyOn(
				GenerationService.prototype,
				"generateSummary",
			);
			generateOneSentenceSummarySpy = vi.spyOn(
				GenerationService.prototype,
				"generateOneSentenceSummary",
			);
			generateTagsSpy = vi.spyOn(GenerationService.prototype, "generateTags");

			// For these tests, we want to test sub-functions of extractDocument,
			// so we restore the original implementation of extractDocument
			summarizeSpy.mockRestore();
		});

		it("calls captureError when getSummaryInput throws", async () => {
			const givenError = new Error("Given Error");
			getSummaryInputSpy.mockRejectedValue(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when generateSummary throws", async () => {
			const givenError = new Error("Given Error");
			getSummaryInputSpy.mockResolvedValueOnce("some summary input");
			generateSummarySpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when generateOneSentenceSummary throws", async () => {
			const givenError = new Error("Given Error");
			getSummaryInputSpy.mockResolvedValueOnce("some summary input");
			generateSummarySpy.mockResolvedValueOnce("some summary");
			generateOneSentenceSummarySpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when generateTags throws", async () => {
			const givenError = new Error("Given Error");
			getSummaryInputSpy.mockResolvedValueOnce("some summary input");
			generateSummarySpy.mockResolvedValueOnce("some summary");
			generateOneSentenceSummarySpy.mockResolvedValueOnce("some short summary");
			generateTagsSpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});
	});

	describe("batchEmbed() errors", () => {
		let markdownStructuralChunkingSpy: ReturnType<typeof vi.spyOn>;
		let generateMistralBatchEmbeddingsSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			markdownStructuralChunkingSpy = vi.spyOn(
				EmbeddingService.prototype,
				"markdownStructuralChunking",
			);
			generateMistralBatchEmbeddingsSpy = vi.spyOn(
				EmbeddingService.prototype,
				"generateMistralBatchEmbeddings",
			);
			// For these tests, we want to test sub-functions of batchEmbed,
			// so we restore the original implementation of batchEmbed
			batchEmbedSpy.mockRestore();
		});

		it("calls captureError when markdownStructuralChunking throws", async () => {
			const givenError = new Error("Given Error");
			markdownStructuralChunkingSpy.mockImplementationOnce(() => {
				throw givenError;
			});

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when generateMistralBatchEmbeddings throws", async () => {
			const givenError = new Error("Given Error");
			generateMistralBatchEmbeddingsSpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});
	});

	describe("logProcessedDocument() errors", () => {
		let logSummarizedDocumentSpy: ReturnType<typeof vi.spyOn>;
		let logEmbeddingsSpy: ReturnType<typeof vi.spyOn>;
		let updateUserDocumentCountSpy: ReturnType<typeof vi.spyOn>;
		let deleteDocumentByIdSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			logSummarizedDocumentSpy = vi.spyOn(
				UserScopedDbService.prototype,
				"logSummarizedDocument",
			);
			logEmbeddingsSpy = vi.spyOn(
				UserScopedDbService.prototype,
				"logEmbeddings",
			);
			updateUserDocumentCountSpy = vi.spyOn(
				UserScopedDbService.prototype,
				"updateUserDocumentCount",
			);
			deleteDocumentByIdSpy = vi.spyOn(
				UserScopedDbService.prototype,
				"deleteDocumentById",
			);
			// For these tests, we want to test sub-functions of logProcessedDocument,
			// so we restore the original implementation of logProcessedDocument
			logProcessedDocumentSpy.mockRestore();
			// We also need to ensure that summarize and batchEmbed succeed so we reach logProcessedDocument
			summarizeSpy.mockResolvedValue(MOCK_SUMMARY_DATA);
			batchEmbedSpy.mockResolvedValue(MOCK_EMBEDDINGS);
			mockClient.from.mockReturnThis();
			mockClient.insert.mockReturnThis();
			mockClient.select.mockReturnThis();
			mockClient.delete.mockReturnThis();
			mockClient.eq.mockReturnThis();
			mockClient.single.mockReturnThis();
		});

		it("calls captureError when insert returns an error", async () => {
			const givenError = new Error("Given Error");
			mockClient.select.mockResolvedValue({
				data: null,
				error: givenError,
			});

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when logSummarizedDocument throws", async () => {
			const givenError = new Error("Given Error");
			mockClient.select.mockResolvedValueOnce({
				data: [{ id: 123 }],
				error: null,
			});
			logSummarizedDocumentSpy.mockRejectedValueOnce(givenError);
			deleteDocumentByIdSpy.mockResolvedValueOnce({});

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when logEmbeddings throws", async () => {
			const givenError = new Error("Given Error");
			mockClient.select.mockResolvedValueOnce({
				data: [{ id: 123 }],
				error: null,
			});
			logSummarizedDocumentSpy.mockResolvedValueOnce({});
			logEmbeddingsSpy.mockRejectedValueOnce(givenError);
			deleteDocumentByIdSpy.mockResolvedValueOnce({});

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when updateUserDocumentCount throws", async () => {
			const givenError = new Error("Given Error");
			mockClient.select.mockResolvedValueOnce({
				data: [{ id: 123 }],
				error: null,
			});
			logSummarizedDocumentSpy.mockResolvedValueOnce({});
			logEmbeddingsSpy.mockResolvedValueOnce({});
			updateUserDocumentCountSpy.mockRejectedValueOnce(givenError);
			deleteDocumentByIdSpy.mockResolvedValueOnce({});

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});

		it("calls captureError when deleteDocumentById throws", async () => {
			const givenError1 = new Error("Given Error 1");
			const givenError2 = new Error("Given Error 2");
			mockClient.select.mockResolvedValueOnce({
				data: [{ id: 123 }],
				error: null,
			});
			logSummarizedDocumentSpy.mockResolvedValueOnce({});
			logEmbeddingsSpy.mockResolvedValueOnce({});
			updateUserDocumentCountSpy.mockRejectedValueOnce(givenError1);
			deleteDocumentByIdSpy.mockRejectedValueOnce(givenError2);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(actualResponse.status).toBe(500);
			expect(captureErrorMock).toHaveBeenCalledWith(givenError2);
			expect(deleteFileFromStorageSpy).toHaveBeenCalledOnce();
		});
	});

	it("calls captureError twice when both processing and cleanup fail", async () => {
		const givenProcessingError = new Error("Given Processing Error");
		const givenCleanupError = new Error("Given Cleanup Error");

		summarizeSpy.mockRejectedValue(givenProcessingError);
		deleteFileFromStorageSpy.mockRejectedValue(givenCleanupError);

		const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

		expect(actualResponse.status).toBe(500);
		expect(captureErrorMock).toHaveBeenCalledTimes(2);

		expect(captureErrorMock).toHaveBeenNthCalledWith(1, givenProcessingError);
		expect(captureErrorMock).toHaveBeenNthCalledWith(2, givenCleanupError);
	});
});
