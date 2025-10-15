import "dotenv/config";

export interface Config {
	azureLlmApiKey?: string;
	azureLlmEndpointGpt4oMini?: string;
	azureLlmEndpointGeneric?: string;
	openAiEndpoint?: string;
	openAiApiKey?: string;
	ollamaApiEndpoint?: string;
	ollamaApiKey?: string;
	mistralApiKey: string;
	mistralApiEndpoint: string;
	qwenEndpoint?: string;
	qwenApiKey?: string;
	jinaApiKey: string;
	jinaEmbeddingModel: string;
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
	supabaseAnonKey: string;
	supabaseJwtKey: string;
	port?: number;
	fileUploadLimitMb?: number;
	chatCompletionContextTokenLimit?: number;
	estimatedTokensPerWord?: number;
	allowDeletion?: boolean;
	llamaParseToken?: string;
	maxPagesLimit?: number;
	maxPagesForLlmParseLimit?: number;
	nodeEnv?: string;
	maxRetries?: number;
	retryDelay?: number;
	modelTemperature: number;
	defaultModelIdentifier: string;
	sentryDsn: string;
	gotenbergUrl: string;
	gotenbergApiBasicAuthUsername: string;
	gotenbergApiBasicAuthPassword: string;
}

/* eslint-disable-next-line complexity */
export function verifyConfig(): void {
	if (!process.env.OPENAI_API_KEY && !process.env.CI) {
		throw new Error("OPENAI_API_KEY must be defined");
	}
	if (!process.env.AZURE_LLM_API_KEY && !process.env.CI) {
		throw new Error("AZURE_LLM_API_KEY must be defined");
	}
	if (!process.env.AZURE_LLM_ENDPOINT_GPT_4O_MINI && !process.env.CI) {
		throw new Error("AZURE_LLM_ENDPOINT_GPT_4O_MINI must be defined");
	}
	if (!process.env.AZURE_LLM_ENDPOINT_GENERIC && !process.env.CI) {
		throw new Error("AZURE_LLM_ENDPOINT_GENERIC must be defined");
	}
	if (!process.env.OPENAI_ENDPOINT && !process.env.CI) {
		throw new Error("OPENAI_ENDPOINT must be defined");
	}
	if (!process.env.OLLAMA_API_ENDPOINT && !process.env.CI) {
		throw new Error("OLLAMA_API_ENDPOINT must be defined");
	}
	if (!process.env.OLLAMA_API_KEY && !process.env.CI) {
		throw new Error("OLLAMA_API_KEY must be defined");
	}
	if (!process.env.MISTRAL_API_KEY) {
		throw new Error("MISTRAL_API_KEY must be defined");
	}
	if (!process.env.MISTRAL_API_ENDPOINT) {
		throw new Error("MISTRAL_API_ENDPOINT must be defined");
	}
	if (!process.env.JINA_API_KEY) {
		throw new Error("JINA_API_KEY must be defined");
	}
	if (!process.env.JINA_EMBEDDING_MODEL) {
		throw new Error("JINA_EMBEDDING_MODEL must be defined");
	}
	if (!process.env.UPLOAD_FILE_SIZE_LIMIT_MB && !process.env.CI) {
		throw new Error("UPLOAD_FILE_SIZE_LIMIT_MB must be defined");
	}
	if (!process.env.CHAT_COMPLETION_CONTEXT_TOKEN_LIMIT && !process.env.CI) {
		throw new Error("CHAT_COMPLETION_CONTEXT_TOKEN_LIMIT must be defined");
	}
	if (!process.env.ESTIMATED_TOKENS_PER_WORD && !process.env.CI) {
		throw new Error("ESTIMATED_TOKENS_PER_WORD must be defined");
	}
	if (!process.env.SUPABASE_URL) {
		throw new Error("SUPABASE_URL must be defined");
	}
	if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
		throw new Error("SUPABASE_SERVICE_ROLE_KEY must be defined");
	}
	if (!process.env.SUPABASE_ANON_KEY) {
		throw new Error("SUPABASE_ANON_KEY must be defined");
	}
	if (!process.env.SUPABASE_JWT_KEY) {
		throw new Error("SUPABASE_JWT_KEY must be defined");
	}
	if (!process.env.ALLOW_DELETION && !process.env.CI) {
		throw new Error("ALLOW_DELETION must be defined");
	}
	if (!process.env.LLAMA_PARSE_TOKEN && !process.env.CI) {
		throw new Error("LLAMA_PARSE_TOKEN must be defined");
	}
	if (!process.env.MAX_PAGES_LIMIT && !process.env.CI) {
		throw new Error("MAX_PAGES_LIMIT must be defined");
	}
	if (!process.env.MAX_PAGES_FOR_LLM_PARSE_LIMIT && !process.env.CI) {
		throw new Error("MAX_PAGES_FOR_LLM_PARSE_LIMIT must be defined");
	}
	if (!process.env.NODE_ENV && !process.env.CI) {
		throw new Error("NODE_ENV must be defined");
	}
	if (!process.env.MAX_RETRIES && !process.env.CI) {
		throw new Error("MAX_RETRIES must be defined");
	}
	if (!process.env.RETRY_DELAY && !process.env.CI) {
		throw new Error("RETRY_DELAY must be defined");
	}
	if (!process.env.MODEL_TEMPERATURE && !process.env.CI) {
		throw new Error("MODEL_TEMPERATURE must be defined");
	}
	if (!process.env.DEFAULT_MODEL_IDENTIFIER) {
		throw new Error("DEFAULT_MODEL_IDENTIFIER must be defined");
	}
	if (!process.env.SENTRY_DSN) {
		throw new Error("SENTRY_DSN must be defined");
	}
	if (!process.env.GOTENBERG_URL && !process.env.CI) {
		throw new Error("GOTENBERG_URL must be defined");
	}
	if (!process.env.GOTENBERG_API_BASIC_AUTH_USERNAME && !process.env.CI) {
		throw new Error("GOTENBERG_API_BASIC_AUTH_USERNAME must be defined");
	}
	if (!process.env.GOTENBERG_API_BASIC_AUTH_PASSWORD && !process.env.CI) {
		throw new Error("GOTENBERG_API_BASIC_AUTH_PASSWORD must be defined");
	}
}

export const config: Config = {
	azureLlmApiKey: process.env.AZURE_LLM_API_KEY,
	azureLlmEndpointGpt4oMini: process.env.AZURE_LLM_ENDPOINT_GPT_4O_MINI,
	azureLlmEndpointGeneric: process.env.AZURE_LLM_ENDPOINT_GENERIC,
	openAiEndpoint: process.env.OPENAI_ENDPOINT,
	openAiApiKey: process.env.OPENAI_API_KEY,
	ollamaApiEndpoint: process.env.OLLAMA_API_ENDPOINT,
	ollamaApiKey: process.env.OLLAMA_API_KEY,
	mistralApiKey: process.env.MISTRAL_API_KEY,
	mistralApiEndpoint: process.env.MISTRAL_API_ENDPOINT,
	qwenEndpoint: process.env.QWEN_ENDPOINT,
	qwenApiKey: process.env.QWEN_API_KEY,
	jinaApiKey: process.env.JINA_API_KEY,
	jinaEmbeddingModel: process.env.JINA_EMBEDDING_MODEL,
	supabaseUrl: process.env.SUPABASE_URL,
	supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
	supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
	supabaseJwtKey: process.env.SUPABASE_JWT_KEY,
	port: Number(process.env.PORT) || 3000,
	fileUploadLimitMb: process.env.UPLOAD_FILE_SIZE_LIMIT_MB
		? parseInt(process.env.UPLOAD_FILE_SIZE_LIMIT_MB, 10)
		: undefined,
	chatCompletionContextTokenLimit: process.env
		.CHAT_COMPLETION_CONTEXT_TOKEN_LIMIT
		? parseInt(process.env.CHAT_COMPLETION_CONTEXT_TOKEN_LIMIT, 10)
		: undefined,
	estimatedTokensPerWord: process.env.ESTIMATED_TOKENS_PER_WORD
		? parseFloat(process.env.ESTIMATED_TOKENS_PER_WORD)
		: undefined,
	allowDeletion: process.env.ALLOW_DELETION === "true",
	llamaParseToken: process.env.LLAMA_PARSE_TOKEN,
	maxPagesLimit: process.env.MAX_PAGES_LIMIT
		? parseInt(process.env.MAX_PAGES_LIMIT, 10)
		: undefined,
	maxPagesForLlmParseLimit: process.env.MAX_PAGES_FOR_LLM_PARSE_LIMIT
		? parseInt(process.env.MAX_PAGES_FOR_LLM_PARSE_LIMIT, 10)
		: undefined,
	nodeEnv: process.env.NODE_ENV,
	maxRetries: process.env.MAX_RETRIES
		? parseInt(process.env.MAX_RETRIES, 10)
		: undefined,
	retryDelay: process.env.RETRY_DELAY
		? parseInt(process.env.RETRY_DELAY, 10)
		: undefined,
	modelTemperature: process.env.MODEL_TEMPERATURE
		? parseFloat(process.env.MODEL_TEMPERATURE)
		: undefined,
	defaultModelIdentifier: process.env.DEFAULT_MODEL_IDENTIFIER,
	sentryDsn: process.env.SENTRY_DSN,
	gotenbergUrl: process.env.GOTENBERG_URL,
	gotenbergApiBasicAuthUsername: process.env.GOTENBERG_API_BASIC_AUTH_USERNAME,
	gotenbergApiBasicAuthPassword: process.env.GOTENBERG_API_BASIC_AUTH_PASSWORD,
};
