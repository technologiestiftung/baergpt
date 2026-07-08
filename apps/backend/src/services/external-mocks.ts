import type {
	EmbeddingModelV3,
	EmbeddingModelV3Result,
	LanguageModelV3,
	LanguageModelV3FinishReason,
	LanguageModelV3GenerateResult,
	LanguageModelV3StreamPart,
	LanguageModelV3StreamResult,
	LanguageModelV3Usage,
} from "@ai-sdk/provider";
import { MockEmbeddingModelV3, MockLanguageModelV3 } from "ai/test";
import { simulateReadableStream } from "ai";
import { ChatPromptClient, TextPromptClient } from "@langfuse/client";
import { config } from "../config";
import type { ParsedPage } from "../types/common";
import { countTokens } from "./token-utils";

/**
 * Canned mock implementations for the external services this backend talks to
 * (Mistral chat + embeddings, Mistral OCR, Gotenberg). They are returned by the
 * provider factories / service methods whenever `NODE_ENV === "test"` so the
 * test suite never reaches the network. The responses are deliberately static:
 * there are no behavioural assertions, the goal is only to keep the real code
 * paths running without external calls.
 */

const MOCK_USAGE: LanguageModelV3Usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const MOCK_FINISH_REASON: LanguageModelV3FinishReason = {
	unified: "stop",
	raw: "stop",
};

/**
 * Plain-text generations (summaries, one-sentence summaries) just receive this
 * string. `generateTags` parses the text as JSON and expects a `tags` array, so
 * returning a JSON object keeps that path working too. Structured-output calls
 * (`Output.object`, used by the streaming citation extraction) ask for a JSON
 * response format; we return an empty object for those. Those paths are not
 * exercised by the test suite — if they ever are, the empty object may need to
 * be shaped to the specific schema.
 */
function mockGenerateText(isJsonResponse: boolean): string {
	return isJsonResponse ? "{}" : '{"tags":["mock-tag"]}';
}

export function mockLanguageModel(): LanguageModelV3 {
	return new MockLanguageModelV3({
		doGenerate: async (options): Promise<LanguageModelV3GenerateResult> => ({
			content: [
				{
					type: "text",
					text: mockGenerateText(options.responseFormat?.type === "json"),
				},
			],
			finishReason: MOCK_FINISH_REASON,
			usage: MOCK_USAGE,
			warnings: [],
		}),
		doStream: async (): Promise<LanguageModelV3StreamResult> => ({
			stream: simulateReadableStream<LanguageModelV3StreamPart>({
				chunks: [
					{ type: "stream-start", warnings: [] },
					{ type: "text-start", id: "0" },
					{ type: "text-delta", id: "0", delta: "mock response" },
					{ type: "text-end", id: "0" },
					{
						type: "finish",
						finishReason: MOCK_FINISH_REASON,
						usage: MOCK_USAGE,
					},
				],
			}),
		}),
	});
}

export function mockEmbeddingModel(): EmbeddingModelV3 {
	return new MockEmbeddingModelV3({
		doEmbed: async ({ values }): Promise<EmbeddingModelV3Result> => ({
			embeddings: values.map(() =>
				new Array(config.mistralEmbeddingDimensions).fill(0),
			),
			usage: { tokens: values.length },
			warnings: [],
		}),
	});
}

export function mockOcrPages(): ParsedPage[] {
	const content = "Mock OCR content.";
	return [
		{
			content,
			pageNumber: 1,
			tokenCount: countTokens(content),
		},
	];
}

export function mockWordToPdf(): Uint8Array {
	return new TextEncoder().encode("%PDF-1.4\n%mock\n");
}

/**
 * Fallback Langfuse prompt clients so `prompt.get` never reaches the Langfuse
 * API in tests. They are constructed with `isFallback = true` and a single
 * static message; `compile()` and `toJSON()` behave like real prompt clients.
 */
export function mockTextPrompt(name: string): TextPromptClient {
	return new TextPromptClient(
		{
			name,
			version: 0,
			labels: [],
			tags: [],
			type: "text",
			prompt: "Mock prompt.",
		},
		true,
	);
}

export function mockChatPrompt(name: string): ChatPromptClient {
	return new ChatPromptClient(
		{
			name,
			version: 0,
			labels: [],
			tags: [],
			type: "chat",
			prompt: [
				{ type: "chatmessage", role: "system", content: "Mock prompt." },
			],
		},
		true,
	);
}
