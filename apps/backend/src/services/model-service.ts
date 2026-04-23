import { config } from "../config";
import { LLMHandler } from "../types/common";
import { mistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";

const aki = createOpenAI({
	baseURL: "https://aki.io/v1",
	apiKey: config.akiApiKey,
});

type ModelProvider = "Mistral";

interface ModelStatus {
	status: number;
	healthy: boolean;
	identifier: string;
	error: string | undefined;
}

class Model {
	identifier: string;
	baseModelName: string;
	provider: ModelProvider;
	isGdprCompliant: boolean;
	contextSize: number;
	isOpenSource: boolean;
	serverLocation: string;
	description: string;
	status?: ModelStatus;

	constructor(params: {
		identifier: string;
		baseModelName: string;
		provider: ModelProvider;
		isGdprCompliant: boolean;
		contextSize: number;
		isOpenSource: boolean;
		serverLocation: string;
		description: string;
		status?: ModelStatus;
	}) {
		this.identifier = params.identifier;
		this.baseModelName = params.baseModelName;
		this.provider = params.provider;
		this.isGdprCompliant = params.isGdprCompliant;
		this.contextSize = params.contextSize;
		this.isOpenSource = params.isOpenSource;
		this.serverLocation = params.serverLocation;
		this.description = params.description;
		this.status = params.status;
	}
}

export class ModelService {
	availableModels: Record<string, Model> = {
		"mistral-small": new Model({
			identifier: config.smallModelIdentifier,
			baseModelName: "mistral-small",
			provider: "Mistral",
			isGdprCompliant: true,
			contextSize: 128000,
			isOpenSource: true,
			serverLocation: "Frankreich",
			description:
				"Aktuelles kleines Modell von Mistral, gehostet von Mistral.",
		}),
		"mistral-large": new Model({
			identifier: config.largeModelIdentifier,
			baseModelName: "mistral-large",
			provider: "Mistral",
			isGdprCompliant: true,
			contextSize: 256000,
			isOpenSource: true,
			serverLocation: "Frankreich",
			description: "Aktuelles großes Modell von Mistral, gehostet von Mistral.",
		}),
	};

	handlers: Record<string, LLMHandler> = {
		"mistral-small": new LLMHandler(
			"mistral-small",
			mistral(config.smallModelIdentifier),
			"https://api.mistral.ai/v1",
		),
		"mistral-large": new LLMHandler(
			"mistral-large",
			aki.chat("minimax_m2_chat"),
			"https://aki.io/v1",
			"openai-compatible",
		),
	};

	resolveLlmHandler(llmType: string): LLMHandler {
		if (!(llmType in this.handlers)) {
			throw new Error(`LLM type ${llmType} is not supported.`);
		}

		return this.handlers[llmType];
	}
}
