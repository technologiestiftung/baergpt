import type { EmbeddingModel, LanguageModel, TranscriptionModel } from "ai";
import { createMistral, mistral } from "@ai-sdk/mistral";
import WebSocket from "ws";
import { config } from "../config";
import {
	mockEmbeddingModel,
	mockLanguageModel,
	mockTranscriptionModel,
} from "./external-mocks";

/**
 * Central factories for the Mistral models. In `test` mode they return static
 * mocks (see external-mocks.ts) so the suite never calls the Mistral API; in
 * every other environment they return the real provider models.
 *
 * IMPORTANT: if you want the test mode locally, you need to put
 *            NODE_ENV=test in your backend .env file. Also when
 *            you want to use a backend in test mode for e2e tests.
 */

const isTestMode = config.nodeEnv === "test";

export function getLanguageModel(identifier: string): LanguageModel {
	if (isTestMode) {
		return mockLanguageModel();
	}

	return mistral(identifier);
}

export function getEmbeddingModel(): EmbeddingModel {
	if (isTestMode) {
		return mockEmbeddingModel();
	}

	return mistral.embeddingModel(config.mistralEmbeddingModel);
}

// Voxtral batch transcription (dictation PoC). Mistral bills per audio minute.
export const TRANSCRIPTION_MODEL = "voxtral-mini-transcribe-3";

export function getTranscriptionModel(): TranscriptionModel {
	if (isTestMode) {
		return mockTranscriptionModel();
	}

	return mistral.transcription(TRANSCRIPTION_MODEL);
}

// Realtime transcription runs over a WebSocket to Mistral. Node's global
// WebSocket cannot send the Authorization header, so we pass `ws`.
const realtimeMistral = createMistral({ webSocket: WebSocket });

export function getRealtimeTranscriptionModel(): TranscriptionModel {
	if (isTestMode) {
		return mockTranscriptionModel();
	}

	return realtimeMistral.transcription("voxtral-mini-transcribe-realtime-3");
}
