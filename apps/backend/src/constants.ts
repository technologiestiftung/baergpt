import { get_encoding } from "@dqbd/tiktoken";
import { config } from "./config";

export interface LLMParameters {
	temperature: number;
	stream: boolean;
}

export const LLM_PARAMETERS = {
	temperature: config.modelTemperature,
	stream: true,
};

export const ragSearchDefaults = {
	match_threshold: 0.3,
	chunk_limit: 10,
};

export const PAGE_SEPARATOR = "[PAGE_BREAK]";
export const JINA_MAX_TOKEN_LIMIT = 8194;
export const enc = get_encoding("o200k_base");
