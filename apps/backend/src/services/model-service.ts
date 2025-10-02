import type { LLMIdentifier } from "../types/common";
import { LLMHandler } from "../types/common";
import { config } from "../config";
import { openai } from "@ai-sdk/openai";
import { createAzure } from "@ai-sdk/azure";
import { mistral } from "@ai-sdk/mistral";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

type ModelProvider = "OpenAI" | "Azure" | "Ollama" | "Mistral";

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
		"openai-gpt-4o-mini": new Model({
			identifier: "openai-gpt-4o-mini",
			baseModelName: "gpt-4o-mini",
			provider: "OpenAI",
			isGdprCompliant: false,
			contextSize: 128000,
			isOpenSource: false,
			serverLocation: "USA",
			description: "Aktuelles Modell von OpenAI, gehostet von OpenAI.",
		}),
		"azure-gpt-4o-mini": new Model({
			identifier: "azure-gpt-4o-mini",
			baseModelName: "gpt-4o-mini",
			provider: "Azure",
			isGdprCompliant: true,
			contextSize: 128000,
			isOpenSource: false,
			serverLocation: "Schweden",
			description:
				"Aktuelles Modell von OpenAI, datenschutzkonform gehostet von Microsoft Azure.",
		}),
		"citylab-macstudio-llama-3.1": new Model({
			identifier: "citylab-macstudio-llama-3.1",
			baseModelName: "llama3.1",
			provider: "Ollama",
			isGdprCompliant: true,
			contextSize: 128000,
			isOpenSource: true,
			serverLocation: "Berlin",
			description:
				"Open Source - Modell von Meta, datenschutzkonform gehostet im CityLAB Berlin.",
		}),
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
		"qwen3-30b-a3b-fp8": new Model({
			identifier: "qwen3-30b-a3b-fp8",
			baseModelName: "Qwen/Qwen3-30B-A3B-FP8",
			provider: "OpenAI",
			isGdprCompliant: true,
			contextSize: 131072,
			isOpenSource: true,
			serverLocation: "Berlin",
			description: "Open Source MoE Modell von Alibaba, gehostet in Berlin.",
		}),
	};

	azure = createAzure({
		resourceName: config.azureLlmEndpointGpt4oMini
			? config.azureLlmEndpointGpt4oMini
					.replace(/^https:\/\//, "")
					.split(".")[0]
			: undefined,
		apiKey: config.azureLlmApiKey,
	});

	ollama = createOpenAICompatible({
		name: "ollama",
		baseURL: config.ollamaApiEndpoint,
		apiKey: config.ollamaApiKey,
		headers: {
			"x-api-key": config.ollamaApiKey,
		},
	});

	qwen = createOpenAICompatible({
		name: "qwen",
		baseURL: config.qwenEndpoint,
		apiKey: config.qwenApiKey,
	});

	handlers: { [key in LLMIdentifier]: LLMHandler } = {
		"openai-gpt-4o-mini": new LLMHandler(
			"gpt-4o-mini",
			openai("gpt-4o-mini"),
			config.openAiEndpoint,
		),
		"azure-gpt-4o-mini": new LLMHandler(
			"gpt-4o-mini",
			this.azure("gpt-4o-mini"),
			config.azureLlmEndpointGpt4oMini,
		),
		"citylab-macstudio-llama-3.1": new LLMHandler(
			"llama3.1",
			this.ollama("llama3.1"),
			config.ollamaApiEndpoint,
		),
		"mistral-small-latest": new LLMHandler(
			"mistral-small",
			mistral("mistral-small-latest"),
			config.mistralApiEndpoint,
		),
		"qwen3-30b-a3b-fp8": new LLMHandler(
			"qwen3-30B",
			this.qwen("Qwen/Qwen3-30B-A3B-FP8"),
			config.qwenEndpoint,
		),
	};

	resolveLlmHandler(llmType: LLMIdentifier): LLMHandler {
		if (!(llmType in this.handlers)) {
			throw new Error(`LLM type ${llmType} is not supported.`);
		}

		return this.handlers[llmType];
	}
}
