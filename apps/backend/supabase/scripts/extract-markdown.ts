/* eslint-disable no-console */
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import {
	DocumentExtractionService,
	WordDocumentExtractionService,
} from "../../src/services/document-extraction-service";

/**
 * Writes exactly the text the backend extracts from a .docx or .pdf (no chunking, no framing).
 *   .docx → <name>.docx.md  (local: mammoth → HTML → Markdown)
 *   .pdf  → <name>.pdf.md   (sends the file to Mistral OCR; pages joined by a blank line)
 *
 * Usage (from apps/backend): npx tsx supabase/scripts/extract-markdown.ts <file.docx|file.pdf> [...]
 * Only use non-sensitive documents for PDFs, since they are sent to Mistral.
 */

const documentExtractionService = new DocumentExtractionService();
const wordExtractionService = new WordDocumentExtractionService();

async function extract(filePath: string): Promise<string> {
	const fileBytes = await readFile(filePath);

	if (filePath.toLowerCase().endsWith(".docx")) {
		return wordExtractionService.extractWordDocument(fileBytes);
	}

	const pages =
		await documentExtractionService.extractPdfAsMarkdownPages(fileBytes);
	return pages.map(({ content }) => content).join("\n\n");
}

async function run() {
	const filePaths = process.argv
		.slice(2)
		.filter((argument) => /\.(docx|pdf)$/i.test(argument));

	if (filePaths.length === 0) {
		console.error(
			"Usage: npx tsx supabase/scripts/extract-markdown.ts <file.docx|file.pdf> [...]",
		);
		process.exit(1);
	}

	for (const filePath of filePaths) {
		const extension = extname(filePath).slice(1).toLowerCase();
		const outputPath = join(
			dirname(filePath),
			`${basename(filePath, extname(filePath))}.${extension}.md`,
		);
		await writeFile(outputPath, await extract(filePath));
		console.log(`${basename(filePath)} → ${outputPath}`);
	}
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
