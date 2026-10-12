type KeyCheckResult = "valid" | "invalid" | "missing_scopes";

/**
 * Publishing is the only Datawrapper endpoint that requires exactly the
 * scopes we need. We deliberately send an invalid chart id, so the request
 * fails ID validation and never publishes anything. Datawrapper checks the
 * token and its scopes before validating the id, so:
 * 400 = all required scopes present, 403 = a scope is missing, 401 = invalid key.
 */
async function checkDatawrapperKey(key: string): Promise<KeyCheckResult> {
	const fakeId = "invalid_value";
	const response = await fetch(
		`https://api.datawrapper.de/v3/charts/${fakeId}/publish`,
		{ method: "POST", headers: { Authorization: `Bearer ${key}` } },
	);

	if (response.status === 400) {
		return "valid";
	}

	if (response.status === 403) {
		return "missing_scopes";
	}

	if (response.status === 401) {
		return "invalid";
	}

	const text = await response.text();
	throw new Error(`Datawrapper key check returned ${response.status}, ${text}`);
}

/**
 * Supported integrations. Must match the provider CHECK constraint on
 * public.user_integration_keys.
 */
export const integrationProviders = {
	datawrapper: {
		requiredScopes: [
			"chart:read",
			"chart:write",
			"theme:read",
			"visualization:read",
		],
		checkKey: checkDatawrapperKey,
	},
};

export type IntegrationProvider = keyof typeof integrationProviders;

export const isIntegrationProvider = (
	value: string,
): value is IntegrationProvider => Object.hasOwn(integrationProviders, value);
