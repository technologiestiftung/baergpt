function parseConfig(env: Record<string, string>) {
	if (!env.VITE_VERCEL_ENV) {
		throw new Error("Environment variable VITE_VERCEL_ENV is missing");
	}
	if (!env.VITE_SUPABASE_URL) {
		throw new Error("Environment variable VITE_SUPABASE_URL is missing");
	}
	if (!env.VITE_SUPABASE_ANON_KEY) {
		throw new Error("Environment variable VITE_SUPABASE_ANON_KEY is missing");
	}
	if (!env.VITE_API_URL) {
		throw new Error("Environment variable VITE_API_URL is missing");
	}
	if (!env.VITE_MAX_TOTAL_FILES_UPLOADED) {
		throw new Error(
			"Environment variable VITE_MAX_TOTAL_FILES_UPLOADED is missing",
		);
	}
	if (!env.VITE_UPLOAD_FILE_SIZE_LIMIT_MB) {
		throw new Error(
			"Environment variable VITE_UPLOAD_FILE_SIZE_LIMIT_MB is missing",
		);
	}
	if (!env.VITE_MAX_PARALLEL_FILE_UPLOADS) {
		throw new Error(
			"Environment variable VITE_MAX_PARALLEL_FILE_UPLOADS is missing",
		);
	}
	if (!env.VITE_ADMIN_URL) {
		throw new Error("Environment variable VITE_ADMIN_URL is missing");
	}
	if (!env.VITE_SENTRY_DSN) {
		throw new Error("Environment variable VITE_SENTRY_DSN is missing");
	}
	if (!env.VITE_SENTRY_ORG) {
		throw new Error("Environment variable VITE_SENTRY_ORG is missing");
	}
	if (!env.VITE_SENTRY_PROJECT) {
		throw new Error("Environment variable VITE_SENTRY_PROJECT is missing");
	}
	if (!env.VITE_TRACE_PROPAGATION_TARGETS) {
		throw new Error(
			"Environment variable VITE_TRACE_PROPAGATION_TARGETS is missing",
		);
	}
	// Note: VITE_MATOMO_URL can be an empty string e.g. in testing environments
	if (typeof env.VITE_MATOMO_URL !== "string") {
		throw new Error("Environment variable VITE_MATOMO_URL is missing");
	}
	// Note: VITE_MATOMO_SITE_ID can be an empty string e.g. in testing environments
	if (typeof env.VITE_MATOMO_SITE_ID !== "string") {
		throw new Error("Environment variable VITE_MATOMO_SITE_ID is missing");
	}
	if (!env.VITE_DEFAULT_DOCUMENT_PROCESSING_MODEL) {
		throw new Error(
			"Environment variable VITE_DEFAULT_DOCUMENT_PROCESSING_MODEL is missing",
		);
	}
	if (!env.VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED) {
		throw new Error(
			"Environment variable VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED is missing",
		);
	}

	return {
		env: env.VITE_VERCEL_ENV,
		supabaseUrl: env.VITE_SUPABASE_URL,
		supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
		apiUrl: env.VITE_API_URL,
		maxTotalFilesUploaded: parseInt(env.VITE_MAX_TOTAL_FILES_UPLOADED, 10),
		uploadFileSizeLimitMB: parseInt(env.VITE_UPLOAD_FILE_SIZE_LIMIT_MB, 10),
		maxParallelFileUploads: parseInt(env.VITE_MAX_PARALLEL_FILE_UPLOADS, 10),
		adminUrl: env.VITE_ADMIN_URL,
		sentryDsn: env.VITE_SENTRY_DSN,
		sentryOrg: env.VITE_SENTRY_ORG,
		sentryProject: env.VITE_SENTRY_PROJECT,
		tracePropagationTargets: env.VITE_TRACE_PROPAGATION_TARGETS.split(","),
		matomoUrl: env.VITE_MATOMO_URL,
		matomoSiteId: env.VITE_MATOMO_SITE_ID,
		defaultDocumentProcessingModel: env.VITE_DEFAULT_DOCUMENT_PROCESSING_MODEL,
		featureFlagMcpParlaAllowed:
			env.VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED === "true",
	};
}
export const config = parseConfig(import.meta.env);
