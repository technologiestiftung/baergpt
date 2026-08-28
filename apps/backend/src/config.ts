import "dotenv/config";

export interface Config {
	mistralApiKey: string;
	mistralEmbeddingModel: string;
	mistralEmbedMaxContextTokens: number;
	mistralEmbedMaxDocumentsPerRequest: number;
	mistralEmbedMaxTotalTokensPerRequest: number;
	mistralEmbeddingDimensions: number;
	mistralMaxRPS: number;
	supabaseUrl: string;
	supabaseServiceRoleKey: string;
	supabaseAnonKey: string;
	supabaseJwtKey: string;
	port?: number;
	fileUploadLimitMb?: number;
	nodeEnv?: string;
	modelTemperature: number;
	smallModelIdentifier: string;
	mediumModelIdentifier: string;
	glmModelIdentifier: string;
	featureFlagGlm52Allowed: boolean;
	defaultDocumentProcessingModel: string;
	sentryDsn: string;
	gotenbergUrl: string;
	gotenbergApiBasicAuthUsername: string;
	gotenbergApiBasicAuthPassword: string;
	presencePenalty: number;
	frequencyPenalty: number;
	featureFlagMcpParlaAllowed: boolean;
	mcpParlaUrl?: string;
	featureFlagMcpOpenDataAllowed: boolean;
	featureFlagMcpDatawrapperAllowed: boolean;
	datawrapperMcpUrl?: string;
	openDataMcpUrl?: string;
	braveSearchApiKey?: string;
	braveSearchApiUrl?: string;
	featureFlagWebSearchAllowed: boolean;
	featureFlagMemoryLog: boolean;
	isTracingEnabled: boolean;
	staanSearchApiKey?: string;
	staanSearchApiUrl?: string;
	staanSearchMaxRPS?: number;
	webSearchProvider?: string;
}

// Required in every environment.
const ALWAYS_REQUIRED_KEYS = [
	"MISTRAL_API_KEY",
	"MISTRAL_EMBEDDING_MODEL",
	"MISTRAL_EMBED_MAX_CONTEXT_TOKENS",
	"MISTRAL_EMBED_MAX_TOTAL_TOKENS_PER_REQUEST",
	"MISTRAL_EMBED_MAX_DOCUMENTS_PER_REQUEST",
	"MISTRAL_EMBEDDING_DIMENSIONS",
	"MISTRAL_MAX_RPS",
	"SUPABASE_URL",
	"SUPABASE_SERVICE_ROLE_KEY",
	"SUPABASE_ANON_KEY",
	"SUPABASE_JWT_KEY",
	"SMALL_MODEL_IDENTIFIER",
	"MEDIUM_MODEL_IDENTIFIER",
	"DEFAULT_DOCUMENT_PROCESSING_MODEL",
	"SENTRY_DSN",
];

// Required in real environments, but exempted in CI since these integrations
// (Gotenberg, real NODE_ENV/MODEL_TEMPERATURE tuning) aren't exercised there.
const REQUIRED_UNLESS_CI_KEYS = [
	"UPLOAD_FILE_SIZE_LIMIT_MB",
	"NODE_ENV",
	"MODEL_TEMPERATURE",
	"GOTENBERG_URL",
	"GOTENBERG_API_BASIC_AUTH_USERNAME",
	"GOTENBERG_API_BASIC_AUTH_PASSWORD",
];

// Only required when the corresponding feature flag is turned on.
const REQUIRED_IF_FLAG_ENABLED: ReadonlyArray<{ flag: string; key: string }> = [
	{ flag: "FEATURE_FLAG_GLM_5_2_ALLOWED", key: "GLM_MODEL_IDENTIFIER" },
	{ flag: "FEATURE_FLAG_MCP_PARLA_ALLOWED", key: "MCP_PARLA_URL" },
	{ flag: "FEATURE_FLAG_MCP_OPEN_DATA_ALLOWED", key: "OPEN_DATA_MCP_URL" },
	{ flag: "FEATURE_FLAG_MCP_DATAWRAPPER_ALLOWED", key: "DATAWRAPPER_MCP_URL" },
];

function collectConfigErrors(): string[] {
	const errors: string[] = [];

	for (const key of ALWAYS_REQUIRED_KEYS) {
		if (!process.env[key]) {
			errors.push(`${key} must be defined`);
		}
	}

	if (!process.env.CI) {
		for (const key of REQUIRED_UNLESS_CI_KEYS) {
			if (!process.env[key]) {
				errors.push(`${key} must be defined`);
			}
		}
	}

	for (const { flag, key } of REQUIRED_IF_FLAG_ENABLED) {
		if (process.env[flag] === "true" && !process.env[key]) {
			errors.push(`${key} must be defined when ${flag} is true`);
		}
	}

	if (
		process.env.FEATURE_FLAG_WEB_SEARCH_ALLOWED === "true" &&
		!(
			(process.env.BRAVE_SEARCH_API_KEY &&
				process.env.BRAVE_SEARCH_API_URL &&
				process.env.BRAVE_SEARCH_MAX_RPS) ||
			(process.env.STAAN_SEARCH_API_KEY &&
				process.env.STAAN_SEARCH_API_URL &&
				process.env.STAAN_SEARCH_MAX_RPS)
		)
	) {
		errors.push(
			"BRAVE_SEARCH_API_KEY, BRAVE_SEARCH_API_URL and BRAVE_SEARCH_MAX_RPS or STAAN_SEARCH_API_KEY, STAAN_SEARCH_API_URL and STAAN_SEARCH_MAX_RPS must be defined when FEATURE_FLAG_WEB_SEARCH_ALLOWED is true",
		);
	}

	return errors;
}

/**
 * Validates all required env vars in one pass and throws with the full list
 * of problems at once. Call this explicitly at app startup (see index.ts) —
 * it's intentionally not run automatically on import, so that standalone
 * scripts which only import a handful of unrelated constants from this
 * package aren't forced to satisfy the entire app's configuration.
 */
export function verifyConfig(): void {
	const errors = collectConfigErrors();
	if (errors.length > 0) {
		throw new Error(`Invalid backend configuration:\n- ${errors.join("\n- ")}`);
	}
}

export const config: Config = {
	mistralApiKey: process.env.MISTRAL_API_KEY as string,
	mistralEmbeddingModel: process.env.MISTRAL_EMBEDDING_MODEL as string,
	mistralEmbedMaxContextTokens: parseInt(
		process.env.MISTRAL_EMBED_MAX_CONTEXT_TOKENS as string,
		10,
	),
	mistralEmbedMaxDocumentsPerRequest: parseInt(
		process.env.MISTRAL_EMBED_MAX_DOCUMENTS_PER_REQUEST as string,
		10,
	),
	mistralEmbedMaxTotalTokensPerRequest: parseInt(
		process.env.MISTRAL_EMBED_MAX_TOTAL_TOKENS_PER_REQUEST as string,
		10,
	),
	mistralEmbeddingDimensions: parseInt(
		process.env.MISTRAL_EMBEDDING_DIMENSIONS as string,
		10,
	),
	mistralMaxRPS: parseInt(process.env.MISTRAL_MAX_RPS as string, 10),
	supabaseUrl: process.env.SUPABASE_URL as string,
	supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
	supabaseAnonKey: process.env.SUPABASE_ANON_KEY as string,
	supabaseJwtKey: process.env.SUPABASE_JWT_KEY as string,
	port: parseInt(process.env.PORT ?? "", 10) || 3000,
	fileUploadLimitMb: parseInt(process.env.UPLOAD_FILE_SIZE_LIMIT_MB ?? "", 10),
	nodeEnv: process.env.NODE_ENV,
	modelTemperature: parseFloat(process.env.MODEL_TEMPERATURE ?? ""),
	smallModelIdentifier: process.env.SMALL_MODEL_IDENTIFIER as string,
	mediumModelIdentifier: process.env.MEDIUM_MODEL_IDENTIFIER as string,
	glmModelIdentifier: process.env.GLM_MODEL_IDENTIFIER as string,
	featureFlagGlm52Allowed: process.env.FEATURE_FLAG_GLM_5_2_ALLOWED === "true",
	defaultDocumentProcessingModel: process.env
		.DEFAULT_DOCUMENT_PROCESSING_MODEL as string,
	sentryDsn: process.env.SENTRY_DSN as string,
	gotenbergUrl: process.env.GOTENBERG_URL as string,
	gotenbergApiBasicAuthUsername: process.env
		.GOTENBERG_API_BASIC_AUTH_USERNAME as string,
	gotenbergApiBasicAuthPassword: process.env
		.GOTENBERG_API_BASIC_AUTH_PASSWORD as string,
	presencePenalty: parseFloat(process.env.PRESENCE_PENALTY || "0"),
	frequencyPenalty: parseFloat(process.env.FREQUENCY_PENALTY || "0"),
	featureFlagMcpParlaAllowed:
		process.env.FEATURE_FLAG_MCP_PARLA_ALLOWED === "true",
	mcpParlaUrl: process.env.MCP_PARLA_URL,
	featureFlagMcpOpenDataAllowed:
		process.env.FEATURE_FLAG_MCP_OPEN_DATA_ALLOWED === "true",
	featureFlagMcpDatawrapperAllowed:
		process.env.FEATURE_FLAG_MCP_DATAWRAPPER_ALLOWED === "true",
	datawrapperMcpUrl: process.env.DATAWRAPPER_MCP_URL,
	openDataMcpUrl: process.env.OPEN_DATA_MCP_URL,
	braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY,
	braveSearchApiUrl: process.env.BRAVE_SEARCH_API_URL,
	featureFlagWebSearchAllowed:
		process.env.FEATURE_FLAG_WEB_SEARCH_ALLOWED === "true",
	featureFlagMemoryLog: process.env.FEATURE_FLAG_MEMORY_LOG === "true",
	isTracingEnabled:
		process.env.NODE_ENV !== undefined &&
		process.env.NODE_ENV !== "production" &&
		process.env.NODE_ENV !== "test",
	staanSearchApiKey: process.env.STAAN_SEARCH_API_KEY,
	staanSearchApiUrl: process.env.STAAN_SEARCH_API_URL,
	staanSearchMaxRPS: parseInt(process.env.STAAN_SEARCH_MAX_RPS ?? "", 10),
	webSearchProvider: process.env.WEB_SEARCH_PROVIDER,
};
