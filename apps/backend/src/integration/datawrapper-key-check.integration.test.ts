import { describe, it, expect } from "vitest";
import { integrationProviders } from "../services/integration-providers";

const allScopesKey = process.env.DATAWRAPPER_TEST_KEY_ALL_SCOPES;
const missingScopeKey = process.env.DATAWRAPPER_TEST_KEY_MISSING_SCOPE;
const { checkKey } = integrationProviders.datawrapper;

/**
 * Verifies against the real Datawrapper API (v3) that the `/publish` probe maps
 * 400 / 403 / 401 to valid / missing_scopes / invalid. The API spec doesn't
 * document error statuses, so this is the only proof of that assumption.
 *
 * Opt-in (skipped unless the env vars are set), since it needs real tokens
 * and network access:
 * - DATAWRAPPER_TEST_KEY_ALL_SCOPES: chart:read, chart:write, theme:read, visualization:read
 * - DATAWRAPPER_TEST_KEY_MISSING_SCOPE: same, but without at least one of them
 */
describe.skipIf(!allScopesKey)("datawrapper key check (live API)", () => {
	it("accepts a key with all required scopes", async () => {
		await expect(checkKey(allScopesKey)).resolves.toBe("valid");
	});

	it("rejects a made-up key as invalid", async () => {
		await expect(checkKey("baergpt-not-a-real-token")).resolves.toBe("invalid");
	});

	it.skipIf(!missingScopeKey)(
		"reports missing scopes for a key without all required scopes",
		async () => {
			await expect(checkKey(missingScopeKey)).resolves.toBe("missing_scopes");
		},
	);
});
