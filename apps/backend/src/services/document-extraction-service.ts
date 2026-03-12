import type { Document, ExtractionResult, ParsedPage } from "../types/common";
import { config } from "../config";
import { Mistral } from "@mistralai/mistralai";
import { createBufferView, getHash, resilientCall } from "../utils";
import { countTokens } from "./token-utils";
import WordExtractor from "word-extractor";
import mammoth from "mammoth";
import XLSX from "xlsx";
import { captureError } from "../monitoring/capture-error";
import { getDocumentProxy } from "unpdf";

export class DocumentExtractionService {
	async extractDocument(
		fileBytes: Uint8Array,
		document: Document,
	): Promise<ExtractionResult> {
		const fileName = document.source_url.split("/").pop();
		const checksum = getHash(fileBytes);
		const fileSize = fileBytes.byteLength;

		if (
			fileName.toLowerCase().endsWith(".doc") ||
			fileName.toLowerCase().endsWith(".docx")
		) {
			const wordExtractor = new WordDocumentExtractionService();
			const wordContent = await wordExtractor.extractWordDocument(
				createBufferView(fileBytes),
			);

			return {
				document: document,
				fileSize: fileSize,
				numPages: 1,
				checksum: checksum,
				parsedPages: [
					{
						content: wordContent,
						pageNumber: 1,
						tokenCount: countTokens(wordContent),
					},
				],
			};
		}

		if (fileName.toLowerCase().endsWith(".xlsx")) {
			const excelExtractor = new ExcelExtractionService();
			const parsedExcelPages =
				await excelExtractor.extractExcelDocument(fileBytes);

			return {
				document: document,
				fileSize: fileSize,
				numPages: parsedExcelPages.length,
				checksum: checksum,
				parsedPages: parsedExcelPages,
			};
		}

		// Use lightweight parsing to determine page count without leaving memory footprint
		const numPages = await this.getPdfPageCount(fileBytes);
		const parsedPages = await this.extractPdfAsMarkdownPages(fileBytes);

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
	 * @returns An array of parsed PDF pages, each containing its markdown content, page number and tokenCount
	 */
	async extractPdfAsMarkdownPages(pdfBytes: Uint8Array): Promise<ParsedPage[]> {
		const fileSizeMb = pdfBytes.byteLength / (1024 * 1024);
		if (fileSizeMb > config.fileUploadLimitMb) {
			throw new Error(
				`PDF file size ${fileSizeMb.toFixed(2)} MB exceeds upload limit of ${config.fileUploadLimitMb} MB.`,
			);
		}

		const ocrService = new MistralOCRService();

		return ocrService.extractTextFromPdfWithMistral(pdfBytes);
	}

	/**
	 * Lightweight PDF page counter using unpdf.
	 */
	async getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
		// Create a copy to avoid detaching the original ArrayBuffer
		const pdfBytesCopy = new Uint8Array(pdfBytes);
		const pdf = await getDocumentProxy(pdfBytesCopy);
		const numPages = pdf.numPages;
		return numPages;
	}
}

export class WordDocumentExtractionService {
	async extractWordDocument(wordDoc: Buffer): Promise<string> {
		try {
			return this.extractWithMammoth(wordDoc);
		} catch (mammothError) {
			captureError(mammothError);

			return this.extractWithWordExtractor(wordDoc);
		}
	}

	async convertDocxToPdf(args: {
		fileName: string;
		wordDoc: Buffer;
	}): Promise<Uint8Array> {
		const { fileName, wordDoc } = args;

		const form = new FormData();
		const bytes = new Uint8Array(
			wordDoc.buffer,
			wordDoc.byteOffset,
			wordDoc.byteLength,
		);
		const blob = new Blob([bytes], {
			type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});
		form.append("files", blob, fileName);

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

		return result.value.trim();
	}

	private async extractWithWordExtractor(wordDoc: Buffer): Promise<string> {
		const extractor = new WordExtractor();
		const extracted = await extractor.extract(wordDoc);
		const body = extracted.getBody();

		return body.trim();
	}
}

export class ExcelExtractionService {
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
			async () =>
				await client.files.upload({
					file: {
						fileName: "uploaded_file.pdf",
						content: buffer,
					},
					purpose: "ocr",
				}),
			{ queueType: "llm" },
		);

		const ocrResponse = await resilientCall(
			async () =>
				await client.ocr.process({
					model: "mistral-ocr-latest",
					document: {
						type: "file",
						fileId: uploaded_pdf.id,
					},
				}),
			{ queueType: "llm" },
		);

		if (!ocrResponse.pages) {
			throw new Error("No pages found in OCR response");
		}
		try {
			await client.files.delete({ fileId: uploaded_pdf.id }); // delete file from Mistral's cloud storage
		} catch (error) {
			if (error?.status !== 404 && error?.statusCode !== 404) {
				captureError(error);
			}
		}
		return ocrResponse.pages.map((page, index) => ({
			content: page.markdown,
			pageNumber: index + 1,
			tokenCount: countTokens(page.markdown),
		}));
	}
}
