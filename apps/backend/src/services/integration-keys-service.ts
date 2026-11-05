import type { ServiceRoleDbClient } from "../supabase";
import {
	decryptIntegrationKey,
	encryptIntegrationKey,
} from "./integration-key-crypto";
import type { IntegrationProvider } from "./integration-providers";

// PostgREST exchanges bytea columns as "\x"-prefixed hex strings.
const toBytea = (hex: string) => `\\x${hex}`;
const fromBytea = (value: string) => value.replace(/^\\x/, "");

/**
 * Stores and reads per-user integration keys. Requires the service role:
 * the table has RLS enabled without policies, so clients can't access it.
 * Plaintext keys only ever exist in backend memory.
 */
export class IntegrationKeysService {
	private readonly client: ServiceRoleDbClient;

	constructor(client: ServiceRoleDbClient) {
		this.client = client;
	}

	async saveKey({
		userId,
		provider,
		key,
		scopes,
	}: {
		userId: string;
		provider: IntegrationProvider;
		key: string;
		scopes: string[];
	}) {
		const { ciphertext, iv, authTag } = encryptIntegrationKey(key, {
			userId,
			provider,
		});

		const { error } = await this.client.from("user_integration_keys").upsert(
			{
				user_id: userId,
				provider,
				ciphertext: toBytea(ciphertext),
				iv: toBytea(iv),
				auth_tag: toBytea(authTag),
				last4: key.slice(-4),
				scopes,
			},
			{ onConflict: "user_id,provider" },
		);

		if (error) {
			throw new Error(`Failed to save integration key: ${error.message}`);
		}
	}

	async getDecryptedKey(
		userId: string,
		provider: IntegrationProvider,
	): Promise<string | null> {
		const { data, error } = await this.client
			.from("user_integration_keys")
			.select("ciphertext, iv, auth_tag")
			.eq("user_id", userId)
			.eq("provider", provider)
			.maybeSingle();

		if (error) {
			throw new Error(`Failed to load integration key: ${error.message}`);
		}
		if (!data) {
			return null;
		}

		return decryptIntegrationKey(
			{
				ciphertext: fromBytea(data.ciphertext),
				iv: fromBytea(data.iv),
				authTag: fromBytea(data.auth_tag),
			},
			{ userId, provider },
		);
	}

	/** Connected integrations of a user, without the keys. */
	async getIntegrations(userId: string) {
		const { data, error } = await this.client
			.from("user_integration_keys")
			.select("provider, last4, scopes, updated_at")
			.eq("user_id", userId);

		if (error) {
			throw new Error(`Failed to load integrations: ${error.message}`);
		}

		return data;
	}

	async deleteKey(userId: string, provider: IntegrationProvider) {
		const { error } = await this.client
			.from("user_integration_keys")
			.delete()
			.eq("user_id", userId)
			.eq("provider", provider);

		if (error) {
			throw new Error(`Failed to delete integration key: ${error.message}`);
		}
	}
}
