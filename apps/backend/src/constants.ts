import { get_encoding } from "@dqbd/tiktoken";
import { config } from "./config";

export interface LLMParameters {
	temperature: number;
	stream: boolean;
	presencePenalty?: number;
	frequencyPenalty?: number;
}

export const LLM_PARAMETERS: LLMParameters = {
	temperature: config.modelTemperature,
	stream: true,
	presencePenalty: 0.5, // Range: -2 to 2. Positive values penalize repeated tokens based on presence.
	frequencyPenalty: 0.5, // Range: -2 to 2. Positive values penalize repeated tokens based on frequency.
};

export const ragSearchDefaults = {
	match_threshold: 0.3,
	chunk_limit: 10,
};

export const PAGE_SEPARATOR = "[PAGE_BREAK]";
export const enc = get_encoding("o200k_base");

export const maxRetries = 2;
export const retryDelay = 1000;
