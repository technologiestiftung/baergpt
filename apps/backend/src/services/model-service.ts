import type { LLMIdentifier } from "../types/common";
import { LLMHandler } from "../types/common";
import { mistral } from "@ai-sdk/mistral";

type ModelProvider = "Mistral";

interface ModelStatus {
	status: number;
	healthy: boolean;
	identifier: LLMIdentifier;
	error: string | undefined;
}

class Model {
	identifier: LLMIdentifier;
	baseModelName: string;
	provider: ModelProvider;
	isGdprCompliant: boolean;
	contextSize: number;
	isOpenSource: boolean;
	serverLocation: string;
	description: string;
	status?: ModelStatus;

	constructor(params: {
		identifier: LLMIdentifier;
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
		"mistral-small-latest": new Model({
			identifier: "mistral-small-latest",
			baseModelName: "mistral-small",
			provider: "Mistral",
			isGdprCompliant: true,
			contextSize: 128000,
			isOpenSource: true,
			serverLocation: "Frankreich",
			description: "Aktuelles Modell von Mistral, gehostet von Mistral.",
		}),
	};

	handlers: { [key in LLMIdentifier]: LLMHandler } = {
		"mistral-small-latest": new LLMHandler(
			"mistral-small",
			mistral("mistral-small-latest"),
			"https://api.mistral.ai/v1",
		),
	};

	resolveLlmHandler(llmType: LLMIdentifier): LLMHandler {
		if (!(llmType in this.handlers)) {
			throw new Error(`LLM type ${llmType} is not supported.`);
		}

		return this.handlers[llmType];
	}
}
