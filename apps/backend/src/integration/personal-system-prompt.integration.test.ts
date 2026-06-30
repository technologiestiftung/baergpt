import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sign } from "hono/jwt";
import { config } from "../config";
import { serviceRoleDbClient, createUserScopedDbClient } from "../supabase";
import { UserScopedDbService } from "../services/db-service/user-scoped-db-service";

const OWNER_USER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";
const INSERT_TRIGGER_USER_ID = "55555555-5555-4555-8555-555555555555";
const OWNER_EMAIL = "psp-owner@local.berlin.de";
const OTHER_EMAIL = "psp-other@local.berlin.de";
const INSERT_TRIGGER_EMAIL = "psp-insert-trigger@local.berlin.de";

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

const setPersonalSystemPrompt = async (
	userId: string,
	personalSystemPrompt: string | null,
) => {
	const { error } = await serviceRoleDbClient
		.from("profiles")
		.update({ personal_system_prompt: personalSystemPrompt })
		.eq("id", userId);

	if (error) {
		throw error;
	}
};

const getPersonalSystemPromptFromProfile = async (
	userId: string,
): Promise<string | null> => {
	const { data, error } = await serviceRoleDbClient
		.from("profiles")
		.select("personal_system_prompt")
		.eq("id", userId)
		.single();

	if (error) {
		throw error;
	}

	return data?.personal_system_prompt ?? null;
};

const createValidJwtToken = async (
	userId: string,
	email: string,
): Promise<string> => {
	return await sign(
		{
			exp: Math.floor(Date.now() / 1000) + 60 * 60,
			sub: userId,
			email,
			role: "authenticated",
		},
		config.supabaseJwtKey,
	);
};

const serviceForUser = async (
	userId: string,
	email: string,
): Promise<UserScopedDbService> => {
	const token = await createValidJwtToken(userId, email);
	return new UserScopedDbService(createUserScopedDbClient(token));
};

describe("personal system prompt integration", () => {
	beforeAll(async () => {
		await createTestUser(OWNER_USER_ID, OWNER_EMAIL);
		await createTestUser(OTHER_USER_ID, OTHER_EMAIL);
		await createTestUser(INSERT_TRIGGER_USER_ID, INSERT_TRIGGER_EMAIL);
	}, 20_000);

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(OWNER_USER_ID);
		await serviceRoleDbClient.auth.admin.deleteUser(OTHER_USER_ID);
		await serviceRoleDbClient.auth.admin.deleteUser(INSERT_TRIGGER_USER_ID);
	});

	describe("getPersonalSystemPrompt", () => {
		it("returns null when the user has no personal system prompt", async () => {
			await setPersonalSystemPrompt(OWNER_USER_ID, null);
			const service = await serviceForUser(OWNER_USER_ID, OWNER_EMAIL);

			const result = await service.getPersonalSystemPrompt(OWNER_USER_ID);

			expect(result).toBeNull();
		});

		it("never exposes another user's personal system prompt (RLS scoping)", async () => {
			await setPersonalSystemPrompt(OWNER_USER_ID, "SECRET OWNER PROMPT");
			const otherUserService = await serviceForUser(OTHER_USER_ID, OTHER_EMAIL);

			// RLS limits reads to the caller's own row, so requesting the owner's
			// prompt as another user resolves to no visible row.
			const result =
				await otherUserService.getPersonalSystemPrompt(OWNER_USER_ID);

			expect(result).toBeNull();
		});
	});

	describe("normalize_personal_system_prompt trigger", () => {
		it("should normalize whitespace-only values to null on profile insert", async () => {
			const whitespaceOnlyPrompt = " \n\t  ";

			const { error: deleteProfileError } = await serviceRoleDbClient
				.from("profiles")
				.delete()
				.eq("id", INSERT_TRIGGER_USER_ID);
			expect(deleteProfileError).toBeNull();

			const { error: insertProfileError } = await serviceRoleDbClient
				.from("profiles")
				.insert({
					id: INSERT_TRIGGER_USER_ID,
					personal_system_prompt: whitespaceOnlyPrompt,
				});
			expect(insertProfileError).toBeNull();

			const storedPrompt = await getPersonalSystemPromptFromProfile(
				INSERT_TRIGGER_USER_ID,
			);

			expect(storedPrompt).toBeNull();
		});

		it("should trim surrounding whitespace on personal system prompt update", async () => {
			await setPersonalSystemPrompt(
				OWNER_USER_ID,
				"\n\t  Bitte antworte kurz und praezise.  \t",
			);

			const storedPrompt =
				await getPersonalSystemPromptFromProfile(OWNER_USER_ID);

			expect(storedPrompt).toBe("Bitte antworte kurz und praezise.");
		});
	});
});
