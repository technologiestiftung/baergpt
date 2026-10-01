import { config } from "../config";
import { LLMHandler } from "../types/common";
import { getLanguageModel } from "./llm-provider";

type modelIdentifiers = "fast" | "precise" | "experimental";

export class ModelService {
	contextSizes: Record<modelIdentifiers, number> = {
		fast: 128_000,
		precise: 256_000,
		experimental: 1_000_000,
	};

	handlers: Record<string, LLMHandler> = {
		fast: new LLMHandler(
			"fast",
			getLanguageModel(config.fastModelIdentifier),
			"https://api.mistral.ai/v1",
		),
		precise: new LLMHandler(
			"precise",
			getLanguageModel(config.preciseModelIdentifier),
			"https://api.mistral.ai/v1",
		),
		...(config.featureFlagExperimentalModelAllowed
			? {
					experimental: new LLMHandler(
						"experimental",
						getLanguageModel(config.experimentalModelIdentifier),
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
