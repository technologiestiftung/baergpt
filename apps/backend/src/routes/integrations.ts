import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { serviceRoleDbClient } from "../supabase";
import { IntegrationKeysService } from "../services/integration-keys-service";
import {
	integrationProviders,
	isIntegrationProvider,
} from "../services/integration-providers";

// Unexpected errors are captured and answered with 500 by app.onError.
const integrations = new Hono();
const integrationKeysService = new IntegrationKeysService(serviceRoleDbClient);

const saveKeyBodySchema = z.object({
	key: z.string().nonempty(),
});

// Route: connected integrations of the user (never returns keys)
integrations.get("/", async (c: Context) => {
	const userId = c.get("authenticatedUserId");
	return c.json(await integrationKeysService.getIntegrations(userId));
});

// Route: check the key's validity and scopes with the provider, then store it encrypted
integrations.put("/:provider/key", async (c: Context) => {
	const provider = c.req.param("provider");
	if (!isIntegrationProvider(provider)) {
		return c.json({ error: "Unknown provider" }, 404);
	}

	// Invalid JSON is a client error (400 below), not a 500 via app.onError
	const body = await c.req.json().catch(() => null);
	const parsedBody = saveKeyBodySchema.safeParse(body);
	if (!parsedBody.success) {
		return c.json({ error: "key must be a non-empty string" }, 400);
	}
	const { key } = parsedBody.data;

	const { requiredScopes, checkKey } = integrationProviders[provider];
	const result = await checkKey(key);
	if (result === "invalid") {
		return c.json({ error: "Invalid API key" }, 422);
	}
	if (result === "missing_scopes") {
		return c.json(
			{ error: "API key is missing required scopes", requiredScopes },
			422,
		);
	}

	const userId = c.get("authenticatedUserId");
	await integrationKeysService.saveKey({
		userId,
		provider,
		key,
		scopes: requiredScopes,
	});
	return c.body(null, 204);
});

// Route: remove the stored key
integrations.delete("/:provider/key", async (c: Context) => {
	const provider = c.req.param("provider");
	if (!isIntegrationProvider(provider)) {
		return c.json({ error: "Unknown provider" }, 404);
	}

	const userId = c.get("authenticatedUserId");
	await integrationKeysService.deleteKey(userId, provider);
	return c.body(null, 204);
});

export default integrations;
