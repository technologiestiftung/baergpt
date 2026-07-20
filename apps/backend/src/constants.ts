import { get_encoding } from "@dqbd/tiktoken";
import { config } from "./config";

export interface LLMParameters {
	temperature: number;
	stream: boolean;
	presencePenalty: number;
	frequencyPenalty: number;
}

export const LLM_PARAMETERS: LLMParameters = {
	temperature: config.modelTemperature,
	stream: true,
	presencePenalty: config.presencePenalty,
	frequencyPenalty: config.frequencyPenalty,
};

export const ragSearchDefaults = {
	match_threshold: 0.3,
	chunk_limit: 10,
};

export const PAGE_SEPARATOR = "[PAGE_BREAK]";
export const enc = get_encoding("o200k_base");

export const maxRetries = 2;
export const retryDelay = 1000;

export const allowedSourceTypes = [
	"personal_document",
	"public_document",
	"default_document",
] as const;

export const ocrTempFileName = "uploaded_file.pdf";
