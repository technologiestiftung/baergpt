/* eslint-disable no-console */

import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import type {
	Document,
	ExtractionResult,
	MarkdownResponse,
	ParsedPage,
	StatusResponse,
	UploadResponse,
} from "../types/common";
import { ExtractError } from "../types/common";
import { config } from "../config";
import { PAGE_SEPARATOR } from "../constants";
import { Mistral } from "@mistralai/mistralai";
import { createBufferView, getHash, resilientCall } from "../utils";
import { countTokens } from "./token-utils";
import WordExtractor from "word-extractor";
import mammoth from "mammoth";
import XLSX from "xlsx";
import { captureError } from "../monitoring/capture-error";

export class DocumentExtractionService {
	async extractDocument(
		fileBytes: Uint8Array,
		document: Document,
	): Promise<ExtractionResult> {
		if (
			document.file_name?.toLowerCase().endsWith(".doc") ||
			document.file_name?.toLowerCase().endsWith(".docx")
		) {
			const wordExtractor = new WordDocumentExtractionService();
			const wordContent = await wordExtractor.extractWordDocument(
				createBufferView(fileBytes),
				document.file_name,
			);
			const checksum = getHash(fileBytes);
			const fileSize = fileBytes.byteLength;

			return {
				document: document,
				fileSize: fileSize,
				numPages: 1,
				checksum: checksum,
				parsedPages: [
					{
						content: wordContent ?? "",
						pageNumber: 1,
						tokenCount: countTokens(wordContent ?? ""),
					},
				],
			};
		} else if (document.file_name?.toLowerCase().endsWith(".xlsx")) {
			const excelExtractor = new ExcelExtractionService();
			const parsedExcelPages =
				await excelExtractor.extractExcelDocument(fileBytes);
			const checksum = getHash(fileBytes);
			const fileSize = fileBytes.byteLength;

			return {
				document: document,
				fileSize: fileSize,
				numPages: parsedExcelPages.length,
				checksum: checksum,
				parsedPages: parsedExcelPages,
			};
		}
		let pdfBytesCopy: Uint8Array | null = new Uint8Array(fileBytes);

		const parser = new PDFParse({
			data: pdfBytesCopy,
		});
		const parseResult = await parser.getInfo({ parsePageInfo: true });
		await parser.destroy();
		const numPages = parseResult.total;

		// Explicitly dereference the copy to allow garbage collection
		pdfBytesCopy = null;

		if (numPages > config.maxPagesLimit) {
			throw new ExtractError(
				document,
				`Could not extract ${document.source_url}, num pages ${numPages} > limit of ${config.maxPagesLimit} pages.`,
			);
		}
		const parsedPages = await this.extractPdfAsMarkdownPages(
			fileBytes,
			document.file_name,
			{ numPages: numPages, ocrProvider: "mistral" },
		);

		const checksum = getHash(fileBytes);
		const fileSize = fileBytes.byteLength;

		return {
			document: document,
			fileSize: fileSize,
			numPages: numPages,
			checksum: checksum,
			parsedPages: parsedPages,
		};
	}

	/**
	 * Extracts markdown content from a PDF file without writing to disk and returns it as pages
	 * @param pdfFilePath Path to the PDF file
	 * @returns An array of parsed PDF pages, each containing its markdown content and page number
	 */
	async extractPdfAsMarkdownPages(
		pdfBytes: Uint8Array,
		fileName: string,
		extractionOptions: {
			numPages: number;
			ocrProvider: string;
		} = {
			numPages: 0,
			ocrProvider: "mistral",
		},
	): Promise<ParsedPage[]> {
		const toParsedPage = (content: string, pageNumber: number): ParsedPage => ({
			content,
			pageNumber,
			tokenCount: countTokens(content),
		});
		let ocrService: MistralOCRService | LlamaParseOCRService;
		if (extractionOptions.ocrProvider === "mistral") {
			ocrService = new MistralOCRService();
		} else if (extractionOptions.ocrProvider === "llamaparse") {
			ocrService = new LlamaParseOCRService();
		} else {
			throw new Error(
				`Unsupported OCR provider: ${extractionOptions.ocrProvider}`,
			);
		}

		if (extractionOptions.numPages <= config.maxPagesForLlmParseLimit) {
			try {
				if (ocrService instanceof MistralOCRService) {
					const pages =
						await ocrService.extractTextFromPdfWithMistral(pdfBytes);
					return pages.map((page) =>
						page.tokenCount !== undefined
							? page
							: toParsedPage(page.content, page.pageNumber),
					);
				} else if (extractionOptions.ocrProvider === "llamaparse") {
					const markdownText = await ocrService.extractMarkdownViaLLamaParse(
						pdfBytes,
						fileName,
					);
					const markdownPages = markdownText.split(PAGE_SEPARATOR);

					return markdownPages.map((content, index) =>
						toParsedPage(content, index),
					);
				}
				throw new Error(
					`Unsupported OCR provider: ${extractionOptions.ocrProvider}`,
				);
			} catch (error) {
				captureError(error);
				// Continue to fallback method
			}
		}

		// For larger PDFs or if LLamaParse fails, use pdf2md
		const pdf2md = (await import("@opendocsg/pdf2md")).default;
		const parsedPages: ParsedPage[] = [];
		const pdfDoc = await PDFDocument.load(pdfBytes);
		for (let i = 0; i < extractionOptions.numPages; i++) {
			// Create a new document containing only this page
			const singlePageDoc = await PDFDocument.create();
			const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
			singlePageDoc.addPage(copiedPage);

			const pageBytes = await singlePageDoc.save();

			// @ts-expect-error pdf2md has no types
			const mdPage = await pdf2md(pageBytes, null);

			parsedPages.push(toParsedPage(mdPage, i));
		}

		return parsedPages;
	}
}

export class WordDocumentExtractionService {
	async extractWordDocument(
		wordDoc: Buffer,
		fileName: string,
	): Promise<string> {
		if (wordDoc.length === 0) {
			captureError(new Error("Empty document buffer"));
			return "";
		}
		if (fileName?.toLowerCase().endsWith(".docx")) {
			try {
				return await this.extractWithMammoth(wordDoc);
			} catch (mammothError) {
				captureError(mammothError);
				try {
					return await this.extractWithWordExtractor(wordDoc);
				} catch (wordExtractorError) {
					captureError(wordExtractorError);
					return "";
				}
			}
		} else if (fileName?.toLowerCase().endsWith(".doc")) {
			try {
				return await this.extractWithWordExtractor(wordDoc);
			} catch (wordExtractorError) {
				captureError(wordExtractorError);
				try {
					return await this.extractWithMammoth(wordDoc);
				} catch (mammothError) {
					captureError(mammothError);
					return "";
				}
			}
		} else {
			throw new Error("Unsupported file type for Word document extraction");
		}
	}

	async convertDocxToPdf(wordDoc: Buffer): Promise<Uint8Array> {
		const form = new FormData();
		const bytes = new Uint8Array(
			wordDoc.buffer,
			wordDoc.byteOffset,
			wordDoc.byteLength,
		);
		const blob = new Blob([bytes], {
			type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});
		form.append("files", blob, "document.docx");

		const endpoint = new URL(
			"/forms/libreoffice/convert",
			config.gotenbergUrl,
		).toString();
		const authHeader = `Basic ${Buffer.from(
			`${config.gotenbergApiBasicAuthUsername}:${config.gotenbergApiBasicAuthPassword}`,
		).toString("base64")}`;

		const res = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: authHeader,
				Accept: "application/pdf",
			},
			body: form,
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} ${await res.text()}`);
		}
		return new Uint8Array(await res.arrayBuffer());
	}

	private async extractWithMammoth(wordDoc: Buffer): Promise<string> {
		const result = await mammoth.extractRawText({ buffer: wordDoc });

		if (result.value && result.value.trim().length > 0) {
			return result.value;
		}
		console.warn("Mammoth extraction returned empty content");
		return "";
	}

	private async extractWithWordExtractor(wordDoc: Buffer): Promise<string> {
		const extractor = new WordExtractor();
		const extracted = await extractor.extract(wordDoc);

		if (extracted && typeof extracted.getBody === "function") {
			const body = extracted.getBody();
			if (body && body.trim().length > 0) {
				return body;
			}
			console.warn("Word-extractor returned empty content");
			return "";
		}

		captureError(
			new Error(
				"Failed to extract content from Word document - invalid extraction result",
			),
		);
		return "";
	}
}

class ExcelExtractionService {
	// Hard caps for work done per sheet to avoid pathological sizes
	// MAX_ROWS / MAX_COLS cap the decoded !ref (0-based, inclusive) relative to the start
	// CELL_MAX limits per-cell text (after trim) before we escape and render to Markdown
	private static readonly MAX_ROWS = 2000;
	private static readonly MAX_COLS = 64;
	private static readonly CELL_MAX = 1024;

	async extractExcelDocument(fileBytes: Uint8Array): Promise<ParsedPage[]> {
		const results: ParsedPage[] = [];
		const workbook = XLSX.read(fileBytes, {
			type: "buffer",
			dense: true,
		});

		workbook.SheetNames.forEach((sheetName, index) => {
			const worksheet = workbook.Sheets[sheetName];
			if (!worksheet) {
				console.warn(`Worksheet not found for sheet: ${sheetName}`);
				return;
			}
			const markdownContent = this.sheetToMarkdown(worksheet);
			const pageContent = `## ${sheetName}\n\n${markdownContent}`;

			results.push({
				content: pageContent,
				pageNumber: index + 1,
				tokenCount: countTokens(pageContent),
			});
		});
		return results;
	}

	private static findLastNonEmptyIndex(arr: string[]): number {
		for (let i = arr.length - 1; i >= 0; i--) {
			if (arr[i] !== "") {
				return i;
			}
		}
		return -1;
	}
	private static sanitizeCell(value: unknown): string {
		const raw = String(value ?? "").trim();
		const truncated =
			raw.length > ExcelExtractionService.CELL_MAX
				? `${raw.slice(0, ExcelExtractionService.CELL_MAX)}…`
				: raw;
		// escape pipes and newlines for Markdown tables
		return truncated.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
	}

	private static ensureColumnWidth(cells: string[], width: number): string[] {
		// Keep at most `width` cells (truncate extras on the right)
		const withinWidth = cells.slice(0, width);

		// If the row is shorter than `width`, compute how many empties to add
		const padCount = Math.max(0, width - withinWidth.length);

		// Pad with empty strings to reach exact `width`, otherwise return as-is
		return padCount > 0
			? withinWidth.concat(Array(padCount).fill(""))
			: withinWidth;
	}

	private sheetToMarkdown(worksheet: XLSX.WorkSheet): string {
		/**
		 * Converts a worksheet into a compact Markdown table with guards:
		 * - Caps processed range using decoded !ref → at most MAX_ROWS × MAX_COLS from start
		 * - Skips hidden rows/columns and blank rows (sheet_to_json opts)
		 * - Trims trailing empty cells in header and data rows
		 * - Enforces consistent column count from the trimmed header
		 * - Escapes Markdown metacharacters and truncates overly long cell contents
		 *
		 * Example input (rows as arrays):
		 *   Header: ["Name", "Age", "", ""]
		 *   Row 1:  ["Alice", "30", "", ""]
		 *   Row 2:  ["Bob", "", "", ""]
		 *   Row 3:  ["", "", "", ""]  // all-empty -> skipped
		 *   Row 4:  ["Carol", "27", "", ""]
		 *
		 * Resulting Markdown:
		 *   | Name | Age |
		 *   |---|---|
		 *   | Alice | 30 |
		 *   | Bob |  |
		 *   | Carol | 27 |
		 */

		// 0) Determine a capped range from !ref
		// !ref is the A1-style sheet bounds. We decode to 0-based row/col (inclusive),
		// then cap the end row/col to at most (start + MAX_* - 1). Finally we re-encode.
		// Example: if !ref="A1:ZZ100000", MAX_ROWS=2000, MAX_COLS=64 and start is A1,
		// cappedRef becomes "A1:BL2000".
		const ref = worksheet["!ref"] || "A1";
		const range = XLSX.utils.decode_range(ref);
		const {
			s: { r: startRowIndex, c: startColIndex },
			e: { r: endRowIndex, c: endColIndex },
		} = range;
		const cappedEndRowIndex = Math.min(
			endRowIndex,
			startRowIndex + ExcelExtractionService.MAX_ROWS - 1,
		);
		const cappedEndColIndex = Math.min(
			endColIndex,
			startColIndex + ExcelExtractionService.MAX_COLS - 1,
		);
		range.e.r = cappedEndRowIndex;
		range.e.c = cappedEndColIndex;
		const cappedRef = XLSX.utils.encode_range(range);

		// 1) Materialize rows using array-of-arrays, skipping hidden/blank
		const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
			header: 1,
			range: cappedRef,
			blankrows: false,
			skipHidden: true,
		});
		if (rows.length === 0) {
			return "";
		}

		/**
		 * Trim trailing empty cells.
		 * Example: ["A", "B", "", ""] -> ["A", "B"]
		 *          ["", "", ""]        -> []
		 */
		const toTrimmed = (cells: string[]): string[] => {
			const last = ExcelExtractionService.findLastNonEmptyIndex(cells);
			return last >= 0 ? cells.slice(0, last + 1) : [];
		};

		// 1) Build a trimmed header to define the table width
		const rawHeader = rows[0].map(ExcelExtractionService.sanitizeCell);
		const headerRow = toTrimmed(rawHeader);
		const columnCount = headerRow.length;

		// If there is no actual header content and no data, return empty
		if (columnCount === 0 && rows.length <= 1) {
			return "";
		}

		const SEP = "---";
		let markdown = "";

		// 2) Render header and separator using the trimmed header
		if (columnCount > 0) {
			markdown += `| ${headerRow.join(" | ")} |\n`;
			markdown += `|${headerRow.map(() => SEP).join("|")}|\n`;
		}

		/**
		 * 3) Render data rows:
		 *    - Trim trailing empty cells
		 *    - Skip all-empty rows
		 *    - Align to header width:
		 *        - Truncate excess cells
		 *        - Pad with "" when too short
		 *
		 * Example:
		 *   Header width = 2
		 *   Row ["A", "", "", ""] -> ["A"] -> pad -> ["A", ""]
		 *   Row ["X", "Y", "Z"]   -> truncate -> ["X", "Y"]
		 */
		for (let i = 1; i < rows.length; i++) {
			const normalized = rows[i].map(ExcelExtractionService.sanitizeCell);
			const trimmed = toTrimmed(normalized);
			if (trimmed.length === 0) {
				continue;
			} // empty row

			const bounded =
				columnCount > 0
					? ExcelExtractionService.ensureColumnWidth(trimmed, columnCount)
					: trimmed;

			markdown += `| ${bounded.join(" | ")} |\n`;
		}
		return markdown;
	}
}

class MistralOCRService {
	async extractTextFromPdfWithMistral(
		pdfBytes: Uint8Array,
	): Promise<ParsedPage[]> {
		const client = new Mistral({ apiKey: config.mistralApiKey });

		const buffer = createBufferView(pdfBytes);

		const uploaded_pdf = await resilientCall(
			() =>
				client.files.upload({
					file: {
						fileName: "uploaded_file.pdf",
						content: buffer,
					},
					purpose: "ocr",
				}),
			{ queueType: "llm" },
		);

		const signedUrl = await resilientCall(() =>
			client.files.getSignedUrl({ fileId: uploaded_pdf.id }),
		);

		const ocrResponse = await resilientCall(
			() =>
				client.ocr.process({
					model: "mistral-ocr-latest",
					document: {
						type: "document_url",
						documentUrl: signedUrl.url,
					},
				}),
			{ retries: 3, queueType: "llm" },
		);

		if (!ocrResponse.pages) {
			throw new Error("No pages found in OCR response");
		}
		await client.files.delete({ fileId: uploaded_pdf.id }); // delete file from Mistral's cloud storage
		return ocrResponse.pages.map(
			(page, index) =>
				({
					content: page.markdown,
					pageNumber: index + 1,
					tokenCount: countTokens(page.markdown),
				}) as ParsedPage,
		);
	}
}

class LlamaParseOCRService {
	TIMEOUT_SECONDS = 300;

	async uploadFileToLLamaParse(
		pdfBytes: Uint8Array,
		fileName: string,
	): Promise<UploadResponse> {
		const blob = new Blob([pdfBytes], { type: "application/pdf" });

		const headers = new Headers();
		headers.append("Authorization", `Bearer ${config.llamaParseToken}`);

		const formdata = new FormData();
		formdata.append("file", blob, fileName);
		formdata.append("page_separator", PAGE_SEPARATOR);
		formdata.append("language", "de");
		formdata.append("accurate_mode", "true"); // Pricing info: https://docs.cloud.llamaindex.ai/llamaparse/usage_data

		const requestOptions = {
			method: "POST",
			headers: headers,
			body: formdata,
		};

		const res = await fetch(
			"https://api.cloud.llamaindex.ai/api/parsing/upload",
			requestOptions,
		);

		if (!res.ok) {
			throw new Error(
				`LLamaParse API returned status ${res.status}: ${await res.text()}`,
			);
		}
		const body = await res.json();
		return body as UploadResponse;
	}

	async checkParsingStatus(jobId: string): Promise<StatusResponse> {
		const headers = new Headers();
		headers.append("Authorization", `Bearer ${config.llamaParseToken}`);

		const requestOptions = {
			method: "GET",
			headers: headers,
		};

		const res = await resilientCall(() =>
			fetch(
				`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
				requestOptions,
			),
		);

		const body = await res.json();

		return body as StatusResponse;
	}

	async fetchMarkdown(jobId: string): Promise<string> {
		const headers = new Headers();
		headers.append("Authorization", `Bearer ${config.llamaParseToken}`);

		const requestOptions = {
			method: "GET",
			headers: headers,
		};

		const res = await resilientCall(() =>
			fetch(
				`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
				requestOptions,
			),
		);

		const body = (await res.json()) as MarkdownResponse;

		return body.markdown;
	}

	async extractMarkdownViaLLamaParse(
		pdfBytes: Uint8Array,
		fileName: string,
	): Promise<string> {
		const uploadRes = await this.uploadFileToLLamaParse(pdfBytes, fileName);

		// Initialize variables for exponential backoff
		let delay = 1000;
		const maxDelay = 20000; // Maximum delay of 20 seconds
		const backoffFactor = 1.5; // Increase delay by this factor each time
		const startTime = Date.now();
		let lastLogTime = startTime;

		// Helper function for waiting
		function sleep(ms: number): Promise<void> {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		let statusRes = await this.checkParsingStatus(uploadRes.id);
		if (process.env.NODE_ENV === "development") {
			console.log(`Initial status for ${fileName}: ${statusRes.status}`);
		}
		while (statusRes.status !== "SUCCESS") {
			if (statusRes.status === "ERROR") {
				throw new Error(
					`File ${fileName} failed to complete markdown extraction via LLamaParse...`,
				);
			}

			const elapsedSeconds = (Date.now() - startTime) / 1000;
			const currentTime = Date.now();

			// Log status approximately every second
			if (currentTime - lastLogTime >= 1000) {
				if (process.env.NODE_ENV === "development") {
					console.log(
						`[${Math.floor(elapsedSeconds)}s] ${fileName} status: ${statusRes.status}`,
					);
				}
				lastLogTime = currentTime;
			}

			if (elapsedSeconds > this.TIMEOUT_SECONDS) {
				throw new Error(
					`File ${fileName} took too long to complete markdown extraction via LLamaParse...`,
				);
			}

			// Wait with exponential backoff before trying again
			await sleep(delay);

			// Increase delay for next iteration, but cap it at maxDelay
			delay = Math.min(delay * backoffFactor, maxDelay);

			statusRes = await this.checkParsingStatus(uploadRes.id);
		}
		if (process.env.NODE_ENV === "development") {
			console.log(
				`Extraction completed successfully for ${fileName} after ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
			);
		}
		const markdown = await this.fetchMarkdown(uploadRes.id);
		return markdown;
	}
}
