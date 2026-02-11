import "dotenv/config";

export interface Config {
	redisUrl: string;
	mistralApiKey: string;
	mistralMaxRPS: number;
	jinaApiKey: string;
	jinaEmbeddingModel: string;
	jinaMaxRPS: number;
	jinaMaxContextTokens: number;
	jinaMaxDocumentsPerRequest: number;
	jinaEmbeddingDimensions: number;
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
	supabaseAnonKey: string;
	supabaseJwtKey: string;
	port?: number;
	fileUploadLimitMb?: number;
	nodeEnv?: string;
	modelTemperature: number;
	smallModelIdentifier: string;
	largeModelIdentifier: string;
	defaultDocumentProcessingModel: string;
	sentryDsn: string;
	gotenbergUrl: string;
	gotenbergApiBasicAuthUsername: string;
	gotenbergApiBasicAuthPassword: string;
	presencePenalty: number;
	frequencyPenalty: number;
	featureFlagMcpParlaAllowed: boolean;
	mcpParlaUrl: string;
}

/* eslint-disable-next-line complexity */
export function verifyConfig(): void {
	if (!process.env.REDIS_URL) {
		throw new Error("REDIS_URL must be defined");
	}
	if (!process.env.MISTRAL_API_KEY) {
		throw new Error("MISTRAL_API_KEY must be defined");
	}
	if (!process.env.MISTRAL_MAX_RPS) {
		throw new Error("MISTRAL_MAX_RPS must be defined");
	}
	if (!process.env.JINA_API_KEY) {
		throw new Error("JINA_API_KEY must be defined");
	}
	if (!process.env.JINA_EMBEDDING_MODEL) {
		throw new Error("JINA_EMBEDDING_MODEL must be defined");
	}
	if (!process.env.JINA_MAX_RPS) {
		throw new Error("JINA_MAX_RPS must be defined");
	}
	if (!process.env.JINA_MAX_CONTEXT_TOKENS) {
		throw new Error("JINA_MAX_CONTEXT_TOKENS must be defined");
	}
	if (!process.env.JINA_MAX_DOCUMENTS_PER_REQUEST) {
		throw new Error("JINA_MAX_DOCUMENTS_PER_REQUEST must be defined");
	}
	if (!process.env.JINA_EMBEDDING_DIMENSIONS) {
		throw new Error("JINA_EMBEDDING_DIMENSIONS must be defined");
	}
	if (!process.env.UPLOAD_FILE_SIZE_LIMIT_MB && !process.env.CI) {
		throw new Error("UPLOAD_FILE_SIZE_LIMIT_MB must be defined");
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
	if (!process.env.NODE_ENV && !process.env.CI) {
		throw new Error("NODE_ENV must be defined");
	}
	if (!process.env.MODEL_TEMPERATURE && !process.env.CI) {
		throw new Error("MODEL_TEMPERATURE must be defined");
	}
	if (!process.env.SMALL_MODEL_IDENTIFIER) {
		throw new Error("SMALL_MODEL_IDENTIFIER must be defined");
	}
	if (!process.env.LARGE_MODEL_IDENTIFIER) {
		throw new Error("LARGE_MODEL_IDENTIFIER must be defined");
	}
	if (!process.env.DEFAULT_DOCUMENT_PROCESSING_MODEL) {
		throw new Error("DEFAULT_DOCUMENT_PROCESSING_MODEL must be defined");
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
	if (
		process.env.FEATURE_FLAG_MCP_PARLA_ALLOWED === "true" &&
		!process.env.MCP_PARLA_URL
	) {
		throw new Error(
			"MCP_PARLA_URL must be defined when FEATURE_FLAG_MCP_PARLA_ALLOWED is true",
		);
	}
}

export const config: Config = {
	redisUrl: process.env.REDIS_URL as string,
	mistralApiKey: process.env.MISTRAL_API_KEY,
	mistralMaxRPS: parseInt(process.env.MISTRAL_MAX_RPS, 10),
	jinaApiKey: process.env.JINA_API_KEY,
	jinaEmbeddingModel: process.env.JINA_EMBEDDING_MODEL,
	jinaMaxRPS: parseInt(process.env.JINA_MAX_RPS, 10),
	jinaMaxContextTokens: parseInt(process.env.JINA_MAX_CONTEXT_TOKENS, 10),
	jinaMaxDocumentsPerRequest: parseInt(
		process.env.JINA_MAX_DOCUMENTS_PER_REQUEST,
		10,
	),
	jinaEmbeddingDimensions: parseInt(process.env.JINA_EMBEDDING_DIMENSIONS, 10),
	supabaseUrl: process.env.SUPABASE_URL,
	supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
	supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
	supabaseJwtKey: process.env.SUPABASE_JWT_KEY,
	port: parseInt(process.env.PORT, 10) || 3000,
	fileUploadLimitMb: parseInt(process.env.UPLOAD_FILE_SIZE_LIMIT_MB, 10),
	nodeEnv: process.env.NODE_ENV,
	modelTemperature: parseFloat(process.env.MODEL_TEMPERATURE),
	smallModelIdentifier: process.env.SMALL_MODEL_IDENTIFIER,
	largeModelIdentifier: process.env.LARGE_MODEL_IDENTIFIER,
	defaultDocumentProcessingModel: process.env.DEFAULT_DOCUMENT_PROCESSING_MODEL,
	sentryDsn: process.env.SENTRY_DSN,
	gotenbergUrl: process.env.GOTENBERG_URL,
	gotenbergApiBasicAuthUsername: process.env.GOTENBERG_API_BASIC_AUTH_USERNAME,
	gotenbergApiBasicAuthPassword: process.env.GOTENBERG_API_BASIC_AUTH_PASSWORD,
	presencePenalty: parseFloat(process.env.PRESENCE_PENALTY || "0"),
	frequencyPenalty: parseFloat(process.env.FREQUENCY_PENALTY || "0"),
	featureFlagMcpParlaAllowed:
		process.env.FEATURE_FLAG_MCP_PARLA_ALLOWED === "true",
	mcpParlaUrl: process.env.MCP_PARLA_URL,
};
