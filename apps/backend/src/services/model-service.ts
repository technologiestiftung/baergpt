import { config } from "../config";
import { LLMHandler } from "../types/common";
import { getLanguageModel } from "./llm-provider";

type modelIdentifiers = "mistral-small" | "mistral-medium" | "zai-glm-5-2";

export class ModelService {
	contextSizes: Record<modelIdentifiers, number> = {
		"mistral-small": 128_000,
		"mistral-medium": 256_000,
		"zai-glm-5-2": 1_000_000,
	};

	handlers: Record<string, LLMHandler> = {
		"mistral-small": new LLMHandler(
			"mistral-small",
			getLanguageModel(config.smallModelIdentifier),
			"https://api.mistral.ai/v1",
		),
		"mistral-medium": new LLMHandler(
			"mistral-medium",
			getLanguageModel(config.mediumModelIdentifier),
			"https://api.mistral.ai/v1",
		),
		...(config.featureFlagGlm52Allowed
			? {
					"zai-glm-5-2": new LLMHandler(
						"zai-glm-5-2",
						getLanguageModel(config.glmModelIdentifier),
						"https://api.mistral.ai/v1",
					),
				}
			: {}),
	};

	resolveLlmHandler(llmType: string): LLMHandler {
		if (!(llmType in this.handlers)) {
			throw new Error(`LLM type ${llmType} is not supported.`);
		}

		return this.handlers[llmType];
	}
}
