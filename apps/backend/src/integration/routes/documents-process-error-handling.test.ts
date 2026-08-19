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
import { config } from "../../config";

const BASE_URL = "http://localhost/documents/process";

// The route now derives the file extension / source_url server-side from the
// uploaded file's mime type, so the metadata no longer carries a source_url.
const VALID_METADATA = {
	document: {
		folderId: null,
		sourceType: "personal_document",
	},
	llmModel: config.defaultDocumentProcessingModel,
};

// Kept as aliases so existing tests read the same; the file (not the metadata)
// now decides pdf/docx/xlsx.
const VALID_PDF_BODY = VALID_METADATA;
const VALID_WORD_BODY = VALID_METADATA;
const VALID_EXCEL_BODY = VALID_METADATA;
const VALID_CSV_BODY = VALID_METADATA;

const DUMMY_BYTES = new Uint8Array([1, 2, 3]);

function pdfFile(): File {
	return new File([DUMMY_BYTES], "some-document.pdf", {
		type: "application/pdf",
	});
}

function wordFile(): File {
	return new File([DUMMY_BYTES], "some-document.docx", {
		type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	});
}

function excelFile(): File {
	return new File([DUMMY_BYTES], "some-document.xlsx", {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
}

function csvFile(): File {
	return new File([DUMMY_BYTES], "some-document.csv", {
		type: "text/csv",
	});
}

function createRequest(metadata: unknown, file: File = pdfFile()): Request {
	const form = new FormData();
	form.append("file", file);
	form.append(
		"metadata",
		typeof metadata === "string" ? metadata : JSON.stringify(metadata),
	);

	// No Content-Type header: FormData sets the multipart boundary itself.
	return new Request(BASE_URL, {
		method: "POST",
		headers: {
			Authorization: "Bearer mock-token",
		},
		body: form,
	});
}

/**
 * The route always responds 200 with an SSE stream; failures are delivered
 * in-band as `{ status: "failed.*" }` events. This reads the whole stream and
 * returns the emitted status strings (heartbeat pings are empty and skipped).
 */
async function getStatuses(response: Response): Promise<string[]> {
	const text = await response.text();
	return text
		.split("\n")
		.filter((line) => line.startsWith("data: "))
		.map((line) => line.slice(6).trim())
		.filter((payload) => payload.length > 0)
		.map((payload) => JSON.parse(payload).status as string);
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

	// Spies that represent the happy-path baseline; individual tests override them.
	// NOTE: validateDocumentRequest is intentionally NOT mocked — it parses
	// and validates the whole multipart request (file/size/format/metadata/path)
	// and returns { sourceUrl, file, bucket, ... }. The real implementation works
	// for the happy-path request built by createRequest(), and the request-level
	// tests rely on it actually throwing.
	let extractDocumentSpy: ReturnType<typeof vi.spyOn>;
	let extractWordDocumentSpy: ReturnType<typeof vi.spyOn>;
	let summarizeSpy: ReturnType<typeof vi.spyOn>;
	let batchEmbedSpy: ReturnType<typeof vi.spyOn>;
	let logProcessedDocumentSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Default: happy-path stubs for all service methods
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
			.mockResolvedValue(123);

		// Stub the cleanup calls so the route's cleanup() (deleteDocument +
		// deleteFileFromStorage) is a no-op by default and doesn't add spurious
		// captureError calls. Individual tests override these when they assert on
		// cleanup behaviour.
		vi.spyOn(UserScopedDbService.prototype, "deleteDocument").mockResolvedValue(
			undefined,
		);
		vi.spyOn(
			UserScopedDbService.prototype,
			"deleteFileFromStorage",
		).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("calls captureError when the metadata is not valid JSON", async () => {
		// Valid file, but metadata is a malformed JSON string → JSON.parse throws.
		const givenRequest = createRequest("{ not json !!!");

		const actualResponse = await app.fetch(givenRequest);

		expect(await getStatuses(actualResponse)).toContain("failed.generic");
		expect(captureErrorMock).toHaveBeenCalledOnce();
	});

	it("emits failed.format when the file part is missing", async () => {
		// validateDocumentRequest throws Error("failed.format") when the `file`
		// part is not a File, so a missing file surfaces as failed.format.
		const form = new FormData();
		form.append("metadata", JSON.stringify(VALID_METADATA));
		const givenRequest = new Request(BASE_URL, {
			method: "POST",
			headers: { Authorization: "Bearer mock-token" },
			body: form,
		});

		const actualResponse = await app.fetch(givenRequest);

		expect(await getStatuses(actualResponse)).toContain("failed.format");
		expect(captureErrorMock).toHaveBeenCalledOnce();
	});

	it("emits failed.generic when the metadata part is missing", async () => {
		const form = new FormData();
		form.append("file", pdfFile());
		const givenRequest = new Request(BASE_URL, {
			method: "POST",
			headers: { Authorization: "Bearer mock-token" },
			body: form,
		});

		const actualResponse = await app.fetch(givenRequest);

		expect(await getStatuses(actualResponse)).toContain("failed.generic");
		expect(captureErrorMock).toHaveBeenCalledOnce();
	});

	it("emits failed.size when the file exceeds the size limit", async () => {
		// The route reads the size off the File that parseBody() reconstructs, so
		// shrink the limit instead of trying to send an oversized file.
		const originalLimit = config.fileUploadLimitMb;
		config.fileUploadLimitMb = 0;

		try {
			const actualResponse = await app.fetch(
				createRequest(VALID_PDF_BODY, pdfFile()),
			);

			expect(await getStatuses(actualResponse)).toContain("failed.size");
			expect(captureErrorMock).toHaveBeenCalledOnce();
		} finally {
			config.fileUploadLimitMb = originalLimit;
		}
	});

	it("emits failed.format for an unsupported mime type", async () => {
		const pngFile = new File([DUMMY_BYTES], "some-image.png", {
			type: "image/png",
		});

		const actualResponse = await app.fetch(
			createRequest(VALID_PDF_BODY, pngFile),
		);

		expect(await getStatuses(actualResponse)).toContain("failed.format");
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

		expect(await getStatuses(actualResponse)).toContain("failed.generic");
		expect(captureErrorMock).toHaveBeenCalledOnce();
		const [capturedArg] = captureErrorMock.mock.calls[0];
		expect(capturedArg.name).toBe("ZodError");
	});

	it("calls captureError when validateDocumentRequest throws", async () => {
		const givenError = new Error("Unexpected DB error during validation");
		vi.spyOn(
			ValidationService.prototype,
			"validateDocumentRequest",
		).mockRejectedValue(givenError);

		const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

		expect(await getStatuses(actualResponse)).toContain("failed.generic");
		expect(captureErrorMock).toHaveBeenCalledOnce();
		expect(captureErrorMock).toHaveBeenCalledWith(givenError);
	});

	describe("extractDocument() errors", () => {
		let givenPdfRequest: Request;
		let givenWordRequest: Request;
		let givenExcelRequest: Request;
		let givenCsvRequest: Request;

		beforeEach(() => {
			givenPdfRequest = createRequest(VALID_PDF_BODY, pdfFile());
			givenWordRequest = createRequest(VALID_WORD_BODY, wordFile());
			givenExcelRequest = createRequest(VALID_EXCEL_BODY, excelFile());
			givenCsvRequest = createRequest(VALID_CSV_BODY, csvFile());

			// For these tests, we want to test sub-functions of extractDocument,
			// so we restore the original implementation of extractDocument
			extractDocumentSpy.mockRestore();
		});

		it("calls captureError when extractWordDocument throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				UserScopedDbService.prototype,
				"savePdfPreview",
			).mockResolvedValueOnce();
			extractWordDocumentSpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenWordRequest);

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when extractExcelDocument throws while processing excel", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				ExcelExtractionService.prototype,
				"extractExcelDocument",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenExcelRequest);

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when extractExcelDocument throws while processing csv", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				ExcelExtractionService.prototype,
				"extractExcelDocument",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenCsvRequest);

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when getPdfPageCount throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				DocumentExtractionService.prototype,
				"getPdfPageCount",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenPdfRequest);

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledOnce();
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when extractPdfAsMarkdownPages throws", async () => {
			const givenError = new Error("Some Error");
			vi.spyOn(
				DocumentExtractionService.prototype,
				"getPdfPageCount",
			).mockResolvedValueOnce(123);
			vi.spyOn(
				DocumentExtractionService.prototype,
				"extractPdfAsMarkdownPages",
			).mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(givenPdfRequest);

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
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

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when generateSummary throws", async () => {
			const givenError = new Error("Given Error");
			getSummaryInputSpy.mockResolvedValueOnce("some summary input");
			generateSummarySpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when generateOneSentenceSummary throws", async () => {
			const givenError = new Error("Given Error");
			getSummaryInputSpy.mockResolvedValueOnce("some summary input");
			generateSummarySpy.mockResolvedValueOnce("some summary");
			generateOneSentenceSummarySpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when generateTags throws", async () => {
			const givenError = new Error("Given Error");
			getSummaryInputSpy.mockResolvedValueOnce("some summary input");
			generateSummarySpy.mockResolvedValueOnce("some summary");
			generateOneSentenceSummarySpy.mockResolvedValueOnce("some short summary");
			generateTagsSpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
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

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
		});

		it("calls captureError when generateMistralBatchEmbeddings throws", async () => {
			const givenError = new Error("Given Error");
			generateMistralBatchEmbeddingsSpy.mockRejectedValueOnce(givenError);

			const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
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

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
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

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
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

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
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

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError);
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

			expect(await getStatuses(actualResponse)).toContain("failed.generic");
			expect(captureErrorMock).toHaveBeenCalledWith(givenError2);
		});
	});

	it("emits canceled and cleans up when the request is aborted after upload", async () => {
		const controller = new AbortController();

		// Abort right after the document is logged and the file is uploaded, so
		// the post-upload `signal.aborted` check fires.
		vi.spyOn(
			UserScopedDbService.prototype,
			"uploadFileToStorage",
		).mockImplementation(async () => {
			controller.abort();
		});
		const deleteDocumentSpy = vi
			.spyOn(UserScopedDbService.prototype, "deleteDocument")
			.mockResolvedValue(undefined);

		const form = new FormData();
		form.append("file", pdfFile());
		form.append("metadata", JSON.stringify(VALID_METADATA));
		const givenRequest = new Request(BASE_URL, {
			method: "POST",
			headers: { Authorization: "Bearer mock-token" },
			body: form,
			signal: controller.signal,
		});

		const actualResponse = await app.fetch(givenRequest);

		expect(await getStatuses(actualResponse)).toContain("canceled");
		expect(deleteDocumentSpy).toHaveBeenCalledWith(123, "test-user-id");
	});

	it("calls captureError twice when both processing and cleanup fail", async () => {
		const givenProcessingError = new Error("Given Processing Error");
		const givenCleanupError = new Error("Given Cleanup Error");

		// Cleanup (deleteDocument) only runs once a documentId exists, i.e. after
		// logProcessedDocument succeeds. So fail on the storage upload (the step
		// after logging) and then fail the cleanup itself.
		vi.spyOn(
			UserScopedDbService.prototype,
			"uploadFileToStorage",
		).mockRejectedValue(givenProcessingError);
		vi.spyOn(UserScopedDbService.prototype, "deleteDocument").mockRejectedValue(
			givenCleanupError,
		);

		const actualResponse = await app.fetch(createRequest(VALID_PDF_BODY));

		expect(await getStatuses(actualResponse)).toContain("failed.generic");
		expect(captureErrorMock).toHaveBeenCalledTimes(2);

		expect(captureErrorMock).toHaveBeenNthCalledWith(1, givenProcessingError);
		expect(captureErrorMock).toHaveBeenNthCalledWith(2, givenCleanupError);
	});
});
