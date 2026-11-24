import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmbeddingService } from "../services/embedding-service";
import type { BaseContentDbService } from "../services/db-service/base-db-service";
import { countMistralTokens } from "../services/token-utils";
import { chunkPage, type PageChunk } from "../services/chunking-service";

// Mock the config and external dependencies
vi.mock("../config", () => ({
	config: {
		mistralApiKey: "test-key",
		mistralEmbeddingModel: "embedding-model-1",
		mistralEmbedMaxContextTokens: 8000,
		mistralEmbedMaxDocumentsPerRequest: 512,
		mistralEmbedMaxTotalTokensPerRequest: 8000,
		mistralEmbeddingDimensions: 1024,
		mistralMaxRPS: 10,
	},
}));

const MAX_TOKENS = 8000;
const TARGET_TOKENS = 1000;
const LONE_SURROGATE =
	/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function expectValidChunks(
	page: string,
	chunks: PageChunk[],
	maxTokens: number = MAX_TOKENS,
) {
	expect(chunks.map(({ content }) => content).join("")).toBe(page);
	for (const { content, embeddingInput, tokenCount } of chunks) {
		expect(content.trim()).not.toBe("");
		expect(countMistralTokens(embeddingInput)).toBeLessThanOrEqual(maxTokens);
		expect(tokenCount).toBe(countMistralTokens(embeddingInput));
		expect(LONE_SURROGATE.test(content)).toBe(false);
	}
}

function germanParagraph(sentences: number): string {
	return "Die Senatsverwaltung prüft den Antrag auf Förderung gemäß § 44 LHO. ".repeat(
		sentences,
	);
}

function markdownTable(rows: number): string {
	const header = "| Bezirk | Einwohner | Fläche in km² |\n|---|---|---|\n";
	const body = Array.from(
		{ length: rows },
		(_, index) =>
			`| Bezirk Nummer ${index} | ${100000 + index} | ${(index % 90) + 10},5 |\n`,
	).join("");
	return header + body;
}

describe("chunkPage", () => {
	it("handles a table separator row with a very long dash run in linear time", () => {
		const page = `| A |\n|${"-".repeat(50000)}x|\n| b |\n`;

		const startedAt = performance.now();
		const chunks = chunkPage(page, {
			targetTokens: MAX_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		// A backtracking separator regex needs ~1e9 steps here, i.e. many seconds
		expect(performance.now() - startedAt).toBeLessThan(1000);
		expectValidChunks(page, chunks);
	});

	it("gives a chunk that starts at the separator row the header line as prefix", () => {
		const paragraph = `${germanParagraph(10)}\n\n`;
		const headerLine = "| H1 | H2 |\n";
		const table = `${headerLine}|---|---|\n${"| a | b |\n".repeat(300)}`;
		// The first chunk holds the paragraph and the header line, nothing more
		const targetTokens =
			countMistralTokens(paragraph) + countMistralTokens(headerLine);

		const chunks = chunkPage(paragraph + table, {
			targetTokens,
			maxTokens: MAX_TOKENS,
		});

		expectValidChunks(paragraph + table, chunks);
		expect(chunks[1].content.startsWith("|---|---|")).toBe(true);
		expect(chunks[1].embeddingInput.startsWith(`${headerLine}|---|---|`)).toBe(
			true,
		);
	});

	it("can split at a heading that directly follows a text line", () => {
		const before = `${germanParagraph(10)}\n`;
		const section = `## Neuer Abschnitt\n${germanParagraph(10)}`;
		const page = before + section;
		// Each part fits on its own, both together don't
		const targetTokens =
			Math.max(countMistralTokens(before), countMistralTokens(section)) + 5;

		const chunks = chunkPage(page, { targetTokens, maxTokens: MAX_TOKENS });

		expectValidChunks(page, chunks);
		expect(
			chunks.some(({ content }) => content.startsWith("## Neuer Abschnitt")),
		).toBe(true);
	});

	it("keeps a page under the target as one chunk", () => {
		const page = "# Titel\n\nKurzer Absatz.\n";
		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks).toHaveLength(1);
		expect(chunks[0].content).toBe(page);
		expect(chunks[0].embeddingInput).toBe(page.trim());
		expectValidChunks(page, chunks);
	});

	it("keeps a PDF-sized page as one chunk", () => {
		const page = `# Seite\n\n${germanParagraph(150)}\n\n${markdownTable(40)}`;
		expect(countMistralTokens(page)).toBeGreaterThan(2000);
		expect(countMistralTokens(page)).toBeLessThan(MAX_TOKENS);

		const chunks = chunkPage(page, {
			targetTokens: MAX_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks).toHaveLength(1);
		expectValidChunks(page, chunks);
	});

	it("splits markdown with headings, lists, code and tables losslessly", () => {
		const page = [
			"# Überschrift ohne Leerzeile",
			germanParagraph(40),
			"",
			"## Liste",
			"",
			"- erster Punkt",
			"  - eingerückter Punkt",
			"- zweiter Punkt",
			"",
			"```ts",
			"function example() {",
			"    return 1;",
			"}",
			"```",
			"",
			markdownTable(60),
			"",
			"### Schluss",
			germanParagraph(80),
		].join("\n");
		expect(countMistralTokens(page)).toBeGreaterThan(3 * TARGET_TOKENS);

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expectValidChunks(page, chunks);
	});

	it("fills chunks near the target", () => {
		const paragraph = germanParagraph(15);
		const paragraphTokens = countMistralTokens(paragraph);
		expect(paragraphTokens).toBeGreaterThan(100);
		expect(paragraphTokens).toBeLessThan(TARGET_TOKENS / 2);
		const page = Array.from({ length: 30 }, () => paragraph).join("\n\n");

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expectValidChunks(page, chunks);
		for (const { tokenCount } of chunks.slice(0, -1)) {
			expect(tokenCount).toBeGreaterThanOrEqual(TARGET_TOKENS / 2);
			expect(tokenCount).toBeLessThanOrEqual(TARGET_TOKENS);
		}
	});

	it("keeps paragraph separators at the end of the previous chunk", () => {
		const paragraph = germanParagraph(15);
		const page = Array.from({ length: 30 }, () => paragraph).join("\n\n");

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		for (const { content } of chunks.slice(0, -1)) {
			expect(content.endsWith("\n\n")).toBe(true);
		}
		for (const { content } of chunks) {
			expect(content.startsWith("\n")).toBe(false);
		}
	});

	it("repeats the table header in the embedding input of continuation chunks", () => {
		const header = "| Bezirk | Einwohner | Fläche in km² |\n|---|---|---|\n";
		const page = `## Tabelle\n\n${markdownTable(400)}`;

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(2);
		expectValidChunks(page, chunks);
		expect(chunks[0].embeddingInput.startsWith(header)).toBe(false);
		for (const { content, embeddingInput } of chunks.slice(1)) {
			expect(content.startsWith("| Bezirk Nummer")).toBe(true);
			expect(embeddingInput.startsWith(header)).toBe(true);
			expect(content.includes("|---|")).toBe(false);
		}
	});

	it("splits a table only between rows", () => {
		const page = markdownTable(400);

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		for (const { content } of chunks) {
			expect(
				content.endsWith("|\n") || content === chunks.at(-1)?.content,
			).toBe(true);
		}
		expectValidChunks(page, chunks);
	});

	it("splits an oversized table row below row level", () => {
		const longCell = germanParagraph(150);
		const page = `| A | B |\n|---|---|\n| ${longCell} | x |\n| kurz | y |\n`;
		expect(countMistralTokens(longCell)).toBeGreaterThan(TARGET_TOKENS);

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expectValidChunks(page, chunks);
	});

	it("splits a long German line without line breaks", () => {
		const page = germanParagraph(1200);
		expect(page.includes("\n")).toBe(false);
		expect(countMistralTokens(page)).toBeGreaterThan(MAX_TOKENS);

		const chunks = chunkPage(page, {
			targetTokens: MAX_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expectValidChunks(page, chunks);
		expect(
			chunks.some(({ usedCharacterFallback }) => usedCharacterFallback),
		).toBe(false);
	});

	it("splits text without whitespace and flags the character fallback", () => {
		const chineseText = "这是一个很长的中文文本，包含许多字符和句子。".repeat(
			2000,
		);
		const minifiedJson = JSON.stringify(
			Array.from({ length: 5000 }, (_, index) => ({
				id: index,
				data: "x".repeat(20),
			})),
		);

		for (const page of [chineseText, minifiedJson]) {
			expect(countMistralTokens(page)).toBeGreaterThan(MAX_TOKENS);
			const chunks = chunkPage(page, {
				targetTokens: MAX_TOKENS,
				maxTokens: MAX_TOKENS,
			});

			expect(chunks.length).toBeGreaterThan(1);
			expectValidChunks(page, chunks);
			expect(
				chunks.some(({ usedCharacterFallback }) => usedCharacterFallback),
			).toBe(true);
		}
	});

	it("never splits surrogate pairs", () => {
		const page = "😀".repeat(20000);

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expectValidChunks(page, chunks);
	});

	it("keeps leading and trailing whitespace in the first and last chunk", () => {
		const paragraph = germanParagraph(15);
		const page = `\n\n   ${Array.from({ length: 10 }, () => paragraph).join("\n\n")}\n\n  \n`;

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0].content.startsWith("\n\n   ")).toBe(true);
		expect(chunks.at(-1)?.content.endsWith("\n\n  \n")).toBe(true);
		expectValidChunks(page, chunks);
	});

	it("returns no chunks for an empty or whitespace-only page", () => {
		for (const page of ["", "   \n\n   \t\t   "]) {
			expect(
				chunkPage(page, { targetTokens: TARGET_TOKENS, maxTokens: MAX_TOKENS }),
			).toEqual([]);
		}
	});

	it("handles CRLF line endings", () => {
		const paragraph = germanParagraph(5);
		const page = Array.from({ length: 20 }, () => paragraph).join("\r\n\r\n");

		const chunks = chunkPage(page, {
			targetTokens: 200,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expectValidChunks(page, chunks);
		for (const { content } of chunks.slice(0, -1)) {
			expect(content.endsWith("\r\n\r\n")).toBe(true);
		}
	});

	it("skips oversized table header prefix", () => {
		const wideHeaderCells = Array.from(
			{ length: 64 },
			(_, index) => `Spalte ${index} mit sehr langer Beschreibung`,
		);
		const header = `| ${wideHeaderCells.join(" | ")} |\n|${wideHeaderCells.map(() => "---").join("|")}|\n`;
		expect(countMistralTokens(header)).toBeGreaterThan(TARGET_TOKENS / 2);
		const rows = Array.from(
			{ length: 300 },
			(_, index) => `| ${wideHeaderCells.map(() => index).join(" | ")} |\n`,
		).join("");
		const page = header + rows;

		const chunks = chunkPage(page, {
			targetTokens: TARGET_TOKENS,
			maxTokens: MAX_TOKENS,
		});

		expect(chunks.length).toBeGreaterThan(1);
		expectValidChunks(page, chunks);
		for (const { embeddingInput } of chunks.slice(1)) {
			expect(embeddingInput.startsWith("| Spalte 0")).toBe(false);
		}
	});
});

describe("EmbeddingService.generateMistralBatchEmbeddings", () => {
	const mockDbService = {
		updateUserColumnValue: vi.fn(),
		logEmbeddings: vi.fn(),
	} as unknown as BaseContentDbService;

	let service: EmbeddingService;

	beforeEach(() => {
		service = new EmbeddingService(mockDbService);
	});

	it("throws instead of skipping an input over the per-request limit", async () => {
		const oversizedInput = "word ".repeat(9000);
		expect(countMistralTokens(oversizedInput)).toBeGreaterThan(8000);

		await expect(
			service.generateMistralBatchEmbeddings(["short", oversizedInput]),
		).rejects.toThrow(/exceeds max 8000/);
	});
});

describe("EmbeddingService.chunkPages", () => {
	const service = new EmbeddingService({} as BaseContentDbService);
	// About 5,000 tokens: one chunk at the PDF target, several at the 1,000 target
	const page = Array.from({ length: 16 }, () => germanParagraph(15)).join(
		"\n\n",
	);
	const parsedPages = [{ content: page, pageNumber: 1, tokenCount: 0 }];

	function chunkCountFor(fileName: string): number {
		return service.chunkPages(parsedPages, {
			source_url: `user/${fileName}`,
			source_type: "personal_document",
			created_at: new Date().toISOString(),
		}).length;
	}

	it("fills PDF pages up to the embedding limit", () => {
		expect(chunkCountFor("bericht.pdf")).toBe(1);
	});

	it("uses the smaller target for files without real pages", () => {
		for (const fileName of [
			"bericht.docx",
			"notiz.MD",
			"tabelle.xlsx",
			"daten.csv",
		]) {
			expect(chunkCountFor(fileName)).toBeGreaterThan(3);
		}
	});

	it("restarts chunk_index on every page", () => {
		const chunks = service.chunkPages(
			[
				{ content: page, pageNumber: 1, tokenCount: 0 },
				{ content: page, pageNumber: 2, tokenCount: 0 },
			],
			{
				source_url: "user/bericht.md",
				source_type: "personal_document",
				created_at: new Date().toISOString(),
			},
		);

		const secondPage = chunks.filter(
			({ page: pageNumber }) => pageNumber === 2,
		);
		expect(secondPage.map(({ chunkIndex }) => chunkIndex)).toEqual(
			secondPage.map((_, index) => index),
		);
	});
});
