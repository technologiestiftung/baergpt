import type { EmbeddingModel, LanguageModel } from "ai";
import { mistral } from "@ai-sdk/mistral";
import { config } from "../config";
import { mockEmbeddingModel, mockLanguageModel } from "./external-mocks";

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
