import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmbeddingService } from "../services/embedding-service";
import { countTokens } from "../services/token-utils";
import { config } from "../config";

// Mock the config and external dependencies
vi.mock("../src/config", () => ({
	config: {
		jinaApiKey: "test-key",
		jinaEmbeddingModel: "embedding-model-1",
		jinaMaxContextTokens: 8192,
		jinaMaxDocumentsPerRequest: 512,
		jinaConcurrentBatches: 10,
	},
}));

vi.mock("./database-service", () => ({
	DatabaseService: vi.fn().mockImplementation(() => ({
		updateUserColumnValue: vi.fn(),
		logEmbeddings: vi.fn(),
	})),
}));

vi.mock("../utils", () => ({
	resilientCall: vi.fn((fn) => fn()),
}));

describe("Chunking Methods", () => {
	let service: EmbeddingService;

	beforeEach(() => {
		service = new EmbeddingService();
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	describe("recursiveChunking", () => {
		it("should return single chunk for text within token limit", () => {
			const text = "This is a short text that fits in one chunk.";
			const chunks = service.recursiveChunking(text);

			expect(chunks).toHaveLength(1);
			expect(chunks[0]).toBe(text);
		});

		it("should split by newlines when text exceeds limit", () => {
			const longLine = "a ".repeat(3000);
			const text = `${longLine}\n${longLine}\n${longLine}`;
			const chunks = service.recursiveChunking(text);

			expect(chunks.length).toBeGreaterThan(1);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(
					config.jinaMaxContextTokens,
				);
			});
		});

		it("should split by sentences when no newlines available", () => {
			const longSentence = "word ".repeat(3000);
			const text = `${longSentence}. ${longSentence}. ${longSentence}.`;
			const chunks = service.recursiveChunking(text);

			expect(chunks.length).toBeGreaterThan(1);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(
					config.jinaMaxContextTokens,
				);
			});
		});

		it("should split by words when no sentence boundaries available", () => {
			// Create text that exceeds the token limit without new lines or sentence boundaries
			const text = "word ".repeat(10000);
			const chunks = service.recursiveChunking(text);

			expect(chunks.length).toBeGreaterThan(1);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(
					config.jinaMaxContextTokens,
				);
			});
		});

		it("should skip edge case with no word boundaries", () => {
			// Very long URL - no spaces, no sentence boundaries
			const veryLongUrl = `https://example.com/verylongpath${"test".repeat(10000)}`;
			const tokenCount = countTokens(veryLongUrl);
			expect(tokenCount).toBeGreaterThan(config.jinaMaxContextTokens);

			const chunks = service.recursiveChunking(veryLongUrl);

			expect(chunks).toEqual([]);
			expect(console.warn).toHaveBeenCalledWith(
				expect.stringContaining("Skipping unchunkable content"),
			);
		});

		it("should handle CSV-like content with semicolons", () => {
			const csvItems = Array(2000)
				.fill(0)
				.map((_, i) => `item${i}`)
				.join(";");
			// Add some spaces to make it chunkable
			const csvWithSpaces = csvItems.replace(/;/g, "; ");
			const chunks = service.recursiveChunking(csvWithSpaces);

			expect(chunks.length).toBeGreaterThan(0);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(8192);
			});
		});

		it("should handle Arabic text with word boundaries", () => {
			const arabicText =
				"هذا نص طويل جداً باللغة العربية يحتوي على العديد من الكلمات والجمل. ".repeat(
					500,
				);
			const chunks = service.recursiveChunking(arabicText);

			expect(chunks.length).toBeGreaterThan(0);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(8192);
				expect(chunk.trim().length).toBeGreaterThan(0);
			});
		});

		it("should handle Chinese text with punctuation boundaries", () => {
			const chineseText = "这是一个很长的中文文本，包含许多字符和句子。".repeat(
				500,
			);
			const chunks = service.recursiveChunking(chineseText);

			expect(chunks.length).toBeGreaterThan(0);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(8192);
			});
		});

		it("should skip minified JSON without spaces", () => {
			const minifiedJson = `{"key":"value","nested":{"deep":"data"}}${JSON.stringify(
				Array(1000)
					.fill(0)
					.map((_, i) => ({ id: i, data: "x".repeat(20) })),
			).replace(/\s/g, "")}`; // Remove all spaces

			const chunks = service.recursiveChunking(minifiedJson);

			expect(chunks).toEqual([]);
		});

		it("should handle edge case of empty string", () => {
			const chunks = service.recursiveChunking("");
			expect(chunks).toEqual([]);
		});

		it("should handle edge case of whitespace only", () => {
			const chunks = service.recursiveChunking("   \n\n   \t\t   ");
			expect(chunks).toEqual([]);
		});
	});

	describe("markdownStructuralChunking - General", () => {
		it("should split by markdown headers", () => {
			const text = `
# Header 1
${"Content for section 1. ".repeat(500)}

## Header 2
${"Content for section 2. ".repeat(500)}

### Header 3
${"Content for section 3. ".repeat(500)}
`;
			const chunks = service.markdownStructuralChunking(text);

			expect(chunks.length).toBeGreaterThan(1);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(8192);
			});
		});

		it("should handle code blocks", () => {
			const text = `
# Code Example

\`\`\`python
${"def function():\n    pass\n".repeat(1000)}
\`\`\`

More content after code block.
`;
			const chunks = service.markdownStructuralChunking(text);

			expect(chunks.length).toBeGreaterThan(0);
			chunks.forEach((chunk) => {
				expect(countTokens(chunk)).toBeLessThanOrEqual(8192);
			});
		});
	});
});
