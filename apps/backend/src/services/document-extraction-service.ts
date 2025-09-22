import { PDFDocument } from "pdf-lib";
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
import { getHash } from "../utils";
import WordExtractor from "word-extractor";
import mammoth from "mammoth";
import puppeteer from "puppeteer";
import XLSX from "xlsx";
import { captureError } from "../monitoring/capture-error";

export class DocumentExtractionService {
	async extractDocument(
		base64Document: string,
		document: Document,
	): Promise<ExtractionResult> {
		if (
			document.file_name?.toLowerCase().endsWith(".doc") ||
			document.file_name?.toLowerCase().endsWith(".docx")
		) {
			const wordExtractor = new WordDocumentExtractionService();
			const wordContent = await wordExtractor.extractWordDocument(
				base64Document,
				document.file_name,
			);
			const checksum = getHash(
				Buffer.from(base64Document, "base64") as Uint8Array,
			);
			const fileSize = Buffer.from(base64Document, "base64").length;

			return {
				document: document,
				fileSize: fileSize,
				numPages: 1,
				checksum: checksum,
				parsedPages: [
					{
						content: wordContent ?? "",
						pageNumber: 1,
					},
				],
			};
		} else if (document.file_name?.toLowerCase().endsWith(".xlsx")) {
			const excelExtractor = new ExcelExtractionService();
			const parsedExcelPages =
				await excelExtractor.extractExcelDocument(base64Document);
			const checksum = getHash(
				Buffer.from(base64Document, "base64") as Uint8Array,
			);
			const fileSize = Buffer.from(base64Document, "base64").length;

			return {
				document: document,
				fileSize: fileSize,
				numPages: parsedExcelPages.length,
				checksum: checksum,
				parsedPages: parsedExcelPages,
			};
		}
		const pdfDoc = await PDFDocument.load(base64Document);
		const numPages = pdfDoc.getPageCount();
		if (numPages > config.maxPagesLimit) {
			throw new ExtractError(
				document,
				`Could not extract ${document.source_url}, num pages ${numPages} > limit of ${config.maxPagesLimit} pages.`,
			);
		}

		const documentBuffer = await pdfDoc.save();

		const parsedPages = await this.extractPdfAsMarkdownPages(
			base64Document,
			document.file_name,
			{ numPages: numPages, ocrProvider: "mistral" },
		);
		const checksum = getHash(documentBuffer);
		const fileSize = Buffer.byteLength(base64Document);

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
		base64Document: string,
		fileName: string,
		extractionOptions: {
			numPages: number;
			ocrProvider: string;
		} = {
			numPages: 0,
			ocrProvider: "mistral",
		},
	): Promise<ParsedPage[]> {
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

		const pdfDoc = await PDFDocument.load(base64Document);

		if (extractionOptions.numPages <= config.maxPagesForLlmParseLimit) {
			try {
				if (ocrService instanceof MistralOCRService) {
					return await ocrService.extractTextFromPdfWithMistral(base64Document);
				} else if (extractionOptions.ocrProvider === "llamaparse") {
					const markdownText = await ocrService.extractMarkdownViaLLamaParse(
						base64Document,
						fileName,
					);
					const markdownPages = markdownText.split(PAGE_SEPARATOR);

					return markdownPages.map((content, index) => ({
						content,
						pageNumber: index,
					})) as ParsedPage[];
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

		for (let i = 0; i < extractionOptions.numPages; i++) {
			// Create a new document containing only this page
			const singlePageDoc = await PDFDocument.create();
			const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
			singlePageDoc.addPage(copiedPage);

			const pdfBytes = await singlePageDoc.save();

			// @ts-expect-error pdf2md has no types
			const mdPage = await pdf2md(pdfBytes, null);

			parsedPages.push({
				content: mdPage,
				pageNumber: i,
			} as ParsedPage);
		}

		return parsedPages;
	}
}

export class WordDocumentExtractionService {
	async extractWordDocument(
		base64Document: string,
		fileName: string,
	): Promise<string> {
		let wordDoc: Buffer;
		try {
			wordDoc = Buffer.from(base64Document, "base64");
		} catch (decodeError) {
			captureError(decodeError);
			return "";
		}

		if (wordDoc.length === 0) {
			captureError(new Error("Empty document buffer after base64 decode"));
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
		// 1. Convert DOCX to HTML with images preserved
		const { value: html } = await mammoth.convertToHtml(
			{ buffer: wordDoc },
			{
				includeEmbeddedStyleMap: true,
				styleMap: [
					"p[style-name='Heading 1'] => h1:fresh",
					"r[style-name='Strong'] => strong",
					"table => table.wp-table:fresh",
					"p[style-name='Table Heading'] => th:fresh",
					"p[style-name='Table Cell'] => td:fresh",
				],
			},
		);
		const styledHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
table.wp-table {
border-collapse: collapse;
width: 100%;
margin: 1rem 0;
}
table.wp-table th, table.wp-table td {
border: 1px solid #dddddd;
padding: 8px;
text-align: left;
}
table.wp-table th {
background-color: #f2f2f2;
}
</style>
</head>
<body>${html}</body>
</html>
`.trim();

		// 2. Use headless Chrome to render HTML+CSS to PDF
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

		await page.setContent(styledHtml, { waitUntil: "networkidle0" });

		// Generate PDF with print emulation
		const pdfBuffer = await page.pdf({
			format: "A4",
			printBackground: true, // Preserves background colors/images
			preferCSSPageSize: true, // Uses CSS @page rules
		});

		await browser.close();
		return pdfBuffer;
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
	async extractExcelDocument(base64Document: string): Promise<ParsedPage[]> {
		const results: ParsedPage[] = [];

		const workbook = XLSX.read(base64Document, {
			type: "base64",
		});

		workbook.SheetNames.forEach((sheetName, index) => {
			const worksheet = workbook.Sheets[sheetName];
			if (!worksheet) {
				console.warn(`Worksheet not found for sheet: ${sheetName}`);
				return;
			}
			const markdownContent = this.sheetToMarkdown(worksheet);

			results.push({
				content: `## ${sheetName}\n\n${markdownContent}`,
				pageNumber: index + 1,
			});
		});
		return results;
	}

	private sheetToMarkdown(worksheet: XLSX.WorkSheet): string {
		const jsonData: string[][] = XLSX.utils.sheet_to_json(worksheet, {
			header: 1,
		});
		if (jsonData.length === 0) {
			return "";
		}

		let markdown = "";

		// Process header row if exists
		if (jsonData.length > 0) {
			markdown += `| ${jsonData[0].join(" | ")} |\n`;
			markdown += `|${jsonData[0].map(() => "---").join("|")}|\n`;
		}

		// Process data rows
		for (let i = 1; i < jsonData.length; i++) {
			markdown += `| ${jsonData[i].join(" | ")} |\n`;
		}

		return markdown;
	}
}

class MistralOCRService {
	async extractTextFromPdfWithMistral(
		base64Document: string,
	): Promise<ParsedPage[]> {
		const client = new Mistral({ apiKey: config.mistralApiKey });

		const pdfDoc = await PDFDocument.load(base64Document);
		const pdfBuffer = await pdfDoc.save();

		const blob = new Blob([pdfBuffer], { type: "application/pdf" });

		const uploaded_pdf = await client.files.upload({
			file: {
				fileName: "uploaded_file.pdf",
				content: blob,
			},
			purpose: "ocr",
		});

		const signedUrl = await client.files.getSignedUrl({
			fileId: uploaded_pdf.id,
		});

		const ocrResponse = await client.ocr.process({
			model: "mistral-ocr-latest",
			document: {
				type: "document_url",
				documentUrl: signedUrl.url,
			},
		});

		if (!ocrResponse.pages) {
			throw new Error("No pages found in OCR response");
		}

		return ocrResponse.pages.map(
			(page, index) =>
				({
					content: page.markdown,
					pageNumber: index + 1,
				}) as ParsedPage,
		);
	}
}

class LlamaParseOCRService {
	TIMEOUT_SECONDS = 300;

	async uploadFileToLLamaParse(
		base64Document: string,
		fileName: string,
	): Promise<UploadResponse> {
		const pdfDoc = await PDFDocument.load(base64Document);
		const pdfBuffer = await pdfDoc.save();

		const blob = new Blob([pdfBuffer], { type: "application/pdf" });

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

		const res = await fetch(
			`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
			requestOptions,
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

		const res = await fetch(
			`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
			requestOptions,
		);

		const body = (await res.json()) as MarkdownResponse;
		return body.markdown;
	}

	async extractMarkdownViaLLamaParse(
		base64Document: string,
		fileName: string,
	): Promise<string> {
		const uploadRes = await this.uploadFileToLLamaParse(
			base64Document,
			fileName,
		);

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
			// eslint-disable-next-line no-console
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
					// eslint-disable-next-line no-console
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
			// eslint-disable-next-line no-console
			console.log(
				`Extraction completed successfully for ${fileName} after ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
			);
		}
		const markdown = await this.fetchMarkdown(uploadRes.id);
		return markdown;
	}
}
