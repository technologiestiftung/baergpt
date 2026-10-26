import type { EmbeddingModel, LanguageModel } from "ai";
import { createMistral, mistral } from "@ai-sdk/mistral";
import { config } from "../config";
import { mockEmbeddingModel, mockLanguageModel } from "./external-mocks";

/**
 * Models that reject reasoning_effort "none" and accept "low" as their lowest
 * setting (GLM 5.3 supports only "low", "high" and "max"). @ai-sdk/mistral
 * currently only knows "high" and "none" and maps "low" to "high", so these
 * models are created with a custom fetch that rewrites "none" to "low" in the
 * request body before it is sent to Mistral.
 *
 * TODO: remove once @ai-sdk/mistral can send "low" for these models.
 */
const modelsWithLowAsMinimumReasoningEffort = new Set(["zai-glm-5-3"]);

const mistralWithLowAsMinimumReasoningEffort = createMistral({
	fetch: async (input, init) => {
		if (typeof init?.body !== "string") {
			return fetch(input, init);
		}

		const body: Record<string, unknown> = JSON.parse(init.body);
		if (body.reasoning_effort !== "none") {
			return fetch(input, init);
		}

		return fetch(input, {
			...init,
			body: JSON.stringify({ ...body, reasoning_effort: "low" }),
		});
	},
});

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

	if (modelsWithLowAsMinimumReasoningEffort.has(identifier)) {
		return mistralWithLowAsMinimumReasoningEffort(identifier);
	}

	return mistral(identifier);
}

export function getEmbeddingModel(): EmbeddingModel {
	if (isTestMode) {
		return mockEmbeddingModel();
	}

	return mistral.embeddingModel(config.mistralEmbeddingModel);
}
