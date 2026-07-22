function parseConfig(env: Record<string, string>) {
	const requiredKeys = [
		"VITE_VERCEL_ENV",
		"VITE_SUPABASE_URL",
		"VITE_SUPABASE_ANON_KEY",
		"VITE_API_URL",
		"VITE_MAX_TOTAL_FILES_UPLOADED",
		"VITE_UPLOAD_FILE_SIZE_LIMIT_MB",
		"VITE_MAX_PARALLEL_FILE_UPLOADS",
		"VITE_ADMIN_URL",
		"VITE_SENTRY_DSN",
		"VITE_SENTRY_ORG",
		"VITE_SENTRY_PROJECT",
		"VITE_TRACE_PROPAGATION_TARGETS",
		"VITE_DEFAULT_DOCUMENT_PROCESSING_MODEL",
		"VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED",
		"VITE_FEATURE_FLAG_MCP_OPEN_DATA_ALLOWED",
		"VITE_FEATURE_FLAG_SPLASH_SCREEN_ALLOWED",
		"VITE_SPLASH_CONTENT_URL",
		"VITE_SPLASH_API_COMMIT_URL",
	];

	for (const key of requiredKeys) {
		if (!env[key]) {
			throw new Error(`Environment variable ${key} is missing`);
		}
	}

	// Note: VITE_MATOMO_URL can be an empty string e.g. in testing environments
	if (typeof env.VITE_MATOMO_URL !== "string") {
		throw new Error("Environment variable VITE_MATOMO_URL is missing");
	}
	// Note: VITE_MATOMO_SITE_ID can be an empty string e.g. in testing environments
	if (typeof env.VITE_MATOMO_SITE_ID !== "string") {
		throw new Error("Environment variable VITE_MATOMO_SITE_ID is missing");
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
		featureFlagMcpOpenDataAllowed:
			env.VITE_FEATURE_FLAG_MCP_OPEN_DATA_ALLOWED === "true",
		featureFlagSplashScreenAllowed:
			env.VITE_FEATURE_FLAG_SPLASH_SCREEN_ALLOWED === "true",
		splashContentUrl: env.VITE_SPLASH_CONTENT_URL,
		splashCommitApiUrl: env.VITE_SPLASH_API_COMMIT_URL,
	};
}
export const config = parseConfig(import.meta.env);
