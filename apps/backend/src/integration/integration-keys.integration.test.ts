import { randomBytes } from "node:crypto";
import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	afterEach,
	vi,
	onTestFinished,
} from "vitest";
import { sign } from "hono/jwt";
import app from "../index";
import { config } from "../config";
import { serviceRoleDbClient, createUserScopedDbClient } from "../supabase";
import {
	decryptIntegrationKey,
	encryptIntegrationKey,
} from "../services/integration-key-crypto";
import { IntegrationKeysService } from "../services/integration-keys-service";
import { integrationProviders } from "../services/integration-providers";

const OWNER_USER_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_USER_ID = "77777777-7777-4777-8777-777777777777";
const OWNER_EMAIL = "integration-keys-owner@ts.berlin";
const OTHER_EMAIL = "integration-keys-other@ts.berlin";
const DELETED_USER_ID = "99999999-9999-4999-8999-999999999999";
const DELETED_EMAIL = "integration-keys-deleted@ts.berlin";

const DATAWRAPPER_KEY = "dw-secret-key-abcdefghijklmnop-wxyz";
const ownerContext = { userId: OWNER_USER_ID, provider: "datawrapper" };

const createTestUser = async (userId: string, email: string) => {
	const { error } = await serviceRoleDbClient.auth.admin.createUser({
		id: userId,
		email,
		password: "SecureTestPassword123!",
		email_confirm: true,
	});

	if (error && !error.message.includes("already registered")) {
		throw error;
	}
};

const createValidJwtToken = async (userId: string, email: string) =>
	await sign(
		{
			exp: Math.floor(Date.now() / 1000) + 60 * 60,
			sub: userId,
			email,
			role: "authenticated",
		},
		config.supabaseJwtKey,
	);

const integrationKeysService = new IntegrationKeysService(serviceRoleDbClient);
const REQUIRED_SCOPES = integrationProviders.datawrapper.requiredScopes;
const saveOwnerKey = () =>
	integrationKeysService.saveKey({
		userId: OWNER_USER_ID,
		provider: "datawrapper",
		key: DATAWRAPPER_KEY,
		scopes: REQUIRED_SCOPES,
	});

// Tests don't depend on the env: they configure their own encryption key.
const originalEncryptionKey = config.integrationKeysEncryptionKey;

describe("integration keys", () => {
	let ownerToken: string;
	let otherToken: string;

	beforeAll(async () => {
		config.integrationKeysEncryptionKey = randomBytes(32).toString("base64");

		await createTestUser(OWNER_USER_ID, OWNER_EMAIL);
		await createTestUser(OTHER_USER_ID, OTHER_EMAIL);
		ownerToken = await createValidJwtToken(OWNER_USER_ID, OWNER_EMAIL);
		otherToken = await createValidJwtToken(OTHER_USER_ID, OTHER_EMAIL);
	}, 20_000);

	afterEach(async () => {
		vi.restoreAllMocks();
		await serviceRoleDbClient
			.from("user_integration_keys")
			.delete()
			.in("user_id", [OWNER_USER_ID, OTHER_USER_ID]);
	});

	afterAll(async () => {
		config.integrationKeysEncryptionKey = originalEncryptionKey;
		await serviceRoleDbClient.auth.admin.deleteUser(OWNER_USER_ID);
		await serviceRoleDbClient.auth.admin.deleteUser(OTHER_USER_ID);
	});

	describe("encryption", () => {
		it("round-trips a key", () => {
			const encrypted = encryptIntegrationKey(DATAWRAPPER_KEY, ownerContext);

			expect(decryptIntegrationKey(encrypted, ownerContext)).toBe(
				DATAWRAPPER_KEY,
			);
		});

		it("uses a fresh IV, so equal keys give different ciphertexts", () => {
			const first = encryptIntegrationKey(DATAWRAPPER_KEY, ownerContext);
			const second = encryptIntegrationKey(DATAWRAPPER_KEY, ownerContext);

			expect(first.iv).not.toBe(second.iv);
			expect(first.ciphertext).not.toBe(second.ciphertext);
		});

		it("fails to decrypt for another user (AAD binding)", () => {
			const encrypted = encryptIntegrationKey(DATAWRAPPER_KEY, ownerContext);

			expect(() =>
				decryptIntegrationKey(encrypted, {
					userId: OTHER_USER_ID,
					provider: "datawrapper",
				}),
			).toThrow();
		});

		it("fails to decrypt a tampered ciphertext", () => {
			const encrypted = encryptIntegrationKey(DATAWRAPPER_KEY, ownerContext);
			const flippedFirstByte = (
				parseInt(encrypted.ciphertext.slice(0, 2), 16) ^ 0x01
			)
				.toString(16)
				.padStart(2, "0");

			expect(() =>
				decryptIntegrationKey(
					{
						...encrypted,
						ciphertext: flippedFirstByte + encrypted.ciphertext.slice(2),
					},
					ownerContext,
				),
			).toThrow();
		});

		it("fails to decrypt with a different encryption key", () => {
			const encrypted = encryptIntegrationKey(DATAWRAPPER_KEY, ownerContext);
			const encryptionKey = config.integrationKeysEncryptionKey;
			config.integrationKeysEncryptionKey = randomBytes(32).toString("base64");
			onTestFinished(() => {
				config.integrationKeysEncryptionKey = encryptionKey;
			});

			expect(() => decryptIntegrationKey(encrypted, ownerContext)).toThrow();
		});
	});

	describe("datawrapper key check", () => {
		it.each([
			[400, "valid"],
			[403, "missing_scopes"],
			[401, "invalid"],
		])("maps status %i of the publish probe to %s", async (status, result) => {
			const fetchSpy = vi
				.spyOn(globalThis, "fetch")
				.mockResolvedValueOnce(new Response(null, { status }));

			await expect(
				integrationProviders.datawrapper.checkKey(DATAWRAPPER_KEY),
			).resolves.toBe(result);
			expect(fetchSpy).toHaveBeenCalledWith(
				expect.stringMatching(/\/charts\/[^/]+\/publish$/),
				expect.objectContaining({
					method: "POST",
					signal: expect.any(AbortSignal),
				}),
			);
		});

		it("throws on unexpected statuses instead of reporting an invalid key", async () => {
			vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
				new Response(null, { status: 503 }),
			);

			await expect(
				integrationProviders.datawrapper.checkKey(DATAWRAPPER_KEY),
			).rejects.toThrow("503");
		});
	});

	describe("database access", () => {
		it("stores only ciphertext and returns the plaintext via the service", async () => {
			await saveOwnerKey();

			const { data } = await serviceRoleDbClient
				.from("user_integration_keys")
				.select("*")
				.eq("user_id", OWNER_USER_ID)
				.single();
			const hexKey = Buffer.from(DATAWRAPPER_KEY, "utf8").toString("hex");
			expect(JSON.stringify(data)).not.toContain(DATAWRAPPER_KEY);
			expect(JSON.stringify(data)).not.toContain(hexKey);
			expect(data.last4).toBe("wxyz");
			expect(data.scopes).toEqual(REQUIRED_SCOPES);

			await expect(
				integrationKeysService.getDecryptedKey(OWNER_USER_ID, "datawrapper"),
			).resolves.toBe(DATAWRAPPER_KEY);
		});

		it("denies authenticated users any direct table access, even to their own row", async () => {
			await saveOwnerKey();
			const ownerClient = createUserScopedDbClient(ownerToken);

			const { error: selectError } = await ownerClient
				.from("user_integration_keys")
				.select("*");
			const { error: insertError } = await ownerClient
				.from("user_integration_keys")
				.insert({
					user_id: OWNER_USER_ID,
					provider: "datawrapper",
					ciphertext: "\\x00",
					iv: "\\x00",
					auth_tag: "\\x00",
					last4: "0000",
					scopes: [],
				});

			expect(selectError?.code).toBe("42501");
			expect(insertError?.code).toBe("42501");
		});

		it("replaces the key when saving again", async () => {
			const newKey = "dw-replacement-key-1234";
			await saveOwnerKey();
			await integrationKeysService.saveKey({
				userId: OWNER_USER_ID,
				provider: "datawrapper",
				key: newKey,
				scopes: REQUIRED_SCOPES,
			});

			const { data } = await serviceRoleDbClient
				.from("user_integration_keys")
				.select("last4")
				.eq("user_id", OWNER_USER_ID);

			expect(data).toEqual([{ last4: "1234" }]);
			await expect(
				integrationKeysService.getDecryptedKey(OWNER_USER_ID, "datawrapper"),
			).resolves.toBe(newKey);
		});

		it("deletes the key together with the user account", async () => {
			await createTestUser(DELETED_USER_ID, DELETED_EMAIL);
			await integrationKeysService.saveKey({
				userId: DELETED_USER_ID,
				provider: "datawrapper",
				key: DATAWRAPPER_KEY,
				scopes: REQUIRED_SCOPES,
			});

			await serviceRoleDbClient.auth.admin.deleteUser(DELETED_USER_ID);

			const { data } = await serviceRoleDbClient
				.from("user_integration_keys")
				.select("id")
				.eq("user_id", DELETED_USER_ID);
			expect(data).toEqual([]);
		});
	});

	describe("routes", () => {
		const request = (
			path: string,
			token: string,
			init: { method?: string; body?: unknown } = {},
		) =>
			app.request(path, {
				method: init.method ?? "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: init.body === undefined ? undefined : JSON.stringify(init.body),
			});

		const putKey = (token: string, body: unknown) =>
			request("/integrations/datawrapper/key", token, { method: "PUT", body });

		const mockKeyCheck = (result: "valid" | "invalid" | "missing_scopes") =>
			vi
				.spyOn(integrationProviders.datawrapper, "checkKey")
				.mockResolvedValue(result);

		it("saves a valid key with its scopes and only ever returns its status", async () => {
			mockKeyCheck("valid");

			const putResponse = await putKey(ownerToken, { key: DATAWRAPPER_KEY });
			const listResponse = await request("/integrations", ownerToken);
			const listBody = await listResponse.json();

			expect(putResponse.status).toBe(204);
			// Exact shape: ciphertext, iv and auth_tag must never be returned
			expect(listBody).toEqual([
				{
					provider: "datawrapper",
					last4: "wxyz",
					scopes: REQUIRED_SCOPES,
					updated_at: expect.any(String),
				},
			]);
			expect(JSON.stringify(listBody)).not.toContain(DATAWRAPPER_KEY);
		});

		it("rejects an invalid key", async () => {
			mockKeyCheck("invalid");

			const response = await putKey(ownerToken, { key: DATAWRAPPER_KEY });

			expect(response.status).toBe(422);
			await expect(
				integrationKeysService.getDecryptedKey(OWNER_USER_ID, "datawrapper"),
			).resolves.toBeNull();
		});

		it("rejects a key without the required scopes and names them", async () => {
			mockKeyCheck("missing_scopes");

			const response = await putKey(ownerToken, { key: DATAWRAPPER_KEY });

			expect(response.status).toBe(422);
			expect(await response.json()).toMatchObject({
				requiredScopes: REQUIRED_SCOPES,
			});
		});

		it("rejects unknown providers and missing keys", async () => {
			const unknownProvider = await request(
				"/integrations/unknown/key",
				ownerToken,
				{ method: "PUT", body: { key: DATAWRAPPER_KEY } },
			);
			const missingKey = await putKey(ownerToken, {});

			expect(unknownProvider.status).toBe(404);
			expect(missingKey.status).toBe(400);
		});

		it("fails without saving when the provider can't be reached", async () => {
			vi.spyOn(integrationProviders.datawrapper, "checkKey").mockRejectedValue(
				new Error("Datawrapper key check returned 503"),
			);

			const response = await putKey(ownerToken, { key: DATAWRAPPER_KEY });

			expect(response.status).toBe(500);
			await expect(
				integrationKeysService.getDecryptedKey(OWNER_USER_ID, "datawrapper"),
			).resolves.toBeNull();
		});

		it("rejects a body that is not JSON", async () => {
			const response = await app.request("/integrations/datawrapper/key", {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${ownerToken}`,
					"Content-Type": "application/json",
				},
				body: "not json",
			});

			expect(response.status).toBe(400);
		});

		it("rejects deleting the key of an unknown provider", async () => {
			const response = await request("/integrations/unknown/key", ownerToken, {
				method: "DELETE",
			});

			expect(response.status).toBe(404);
		});

		it("scopes keys to the authenticated user", async () => {
			await saveOwnerKey();

			const otherList = await request("/integrations", otherToken);
			await request("/integrations/datawrapper/key", otherToken, {
				method: "DELETE",
			});

			expect(await otherList.json()).toEqual([]);
			await expect(
				integrationKeysService.getDecryptedKey(OWNER_USER_ID, "datawrapper"),
			).resolves.toBe(DATAWRAPPER_KEY);
		});

		it("deletes the key", async () => {
			await saveOwnerKey();

			const response = await request(
				"/integrations/datawrapper/key",
				ownerToken,
				{ method: "DELETE" },
			);

			expect(response.status).toBe(204);
			await expect(
				integrationKeysService.getDecryptedKey(OWNER_USER_ID, "datawrapper"),
			).resolves.toBeNull();
		});

		it("requires authentication", async () => {
			const response = await app.request("/integrations");

			expect(response.status).toBe(401);
		});
	});
});
