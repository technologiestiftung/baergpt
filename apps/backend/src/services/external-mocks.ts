import type {
	EmbeddingModelV4Result,
	LanguageModelV4FinishReason,
	LanguageModelV4GenerateResult,
	LanguageModelV4StreamPart,
	LanguageModelV4StreamResult,
	LanguageModelV4Usage,
	Experimental_TranscriptionModelV4StreamResult as TranscriptionModelV4StreamResult,
} from "@ai-sdk/provider";
import type {
	EmbeddingModel,
	LanguageModel,
	SpeechModel,
	TranscriptionModel,
} from "ai";
import {
	MockEmbeddingModelV4,
	MockLanguageModelV4,
	MockSpeechModelV4,
	MockTranscriptionModelV4,
} from "ai/test";
import { simulateReadableStream } from "ai";
import { ReadableStream as NodeReadableStream } from "node:stream/web";
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

const MOCK_USAGE: LanguageModelV4Usage = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const MOCK_FINISH_REASON: LanguageModelV4FinishReason = {
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

export function mockLanguageModel(): LanguageModel {
	return new MockLanguageModelV4({
		doGenerate: async (options): Promise<LanguageModelV4GenerateResult> => ({
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
		doStream: async (options): Promise<LanguageModelV4StreamResult> => ({
			stream: simulateReadableStream<LanguageModelV4StreamPart>({
				chunks: [
					{ type: "stream-start", warnings: [] },
					...(options.reasoning !== undefined && options.reasoning !== "none"
						? ([
								{ type: "reasoning-start", id: "r0" },
								{ type: "reasoning-delta", id: "r0", delta: "mock reasoning" },
								{ type: "reasoning-end", id: "r0" },
							] satisfies LanguageModelV4StreamPart[])
						: []),
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

export function mockEmbeddingModel(): EmbeddingModel {
	return new MockEmbeddingModelV4({
		doEmbed: async ({ values }): Promise<EmbeddingModelV4Result> => ({
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

export function mockTranscriptionModel(): TranscriptionModel {
	return new MockTranscriptionModelV4({
		doGenerate: async () => ({
			text: "Mock transcription.",
			segments: [],
			language: "de",
			durationInSeconds: 1,
			warnings: [],
			response: { timestamp: new Date(0), modelId: "mock-transcription" },
		}),
		// Realtime: drain the incoming audio, then emit one fixed transcript.
		doStream: async ({ audio }) => {
			// Backend tsconfig has no DOM lib, so use Node's web stream types.
			const reader = (audio as unknown as NodeReadableStream).getReader();
			const text = "Mock transcription.";
			return {
				stream: new NodeReadableStream({
					async start(controller) {
						controller.enqueue({ type: "stream-start", warnings: [] });
						while (!(await reader.read()).done) {
							// Discard audio chunks until the client stops.
						}
						controller.enqueue({ type: "transcript-delta", delta: text });
						controller.enqueue({ type: "finish", text, segments: [] });
						controller.close();
					},
				}) as unknown as TranscriptionModelV4StreamResult["stream"],
			};
		},
	});
}

export function mockSpeechModel(): SpeechModel {
	return new MockSpeechModelV4({
		doGenerate: async () => ({
			// "ID3" header bytes; enough for tests, not playable audio.
			audio: new Uint8Array([0x49, 0x44, 0x33]),
			warnings: [],
			response: { timestamp: new Date(0), modelId: "mock-speech" },
		}),
	});
}
