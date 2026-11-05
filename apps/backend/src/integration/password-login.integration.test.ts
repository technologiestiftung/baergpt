import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { serviceRoleDbClient } from "../supabase";
import { config } from "../config";
import { signInWithOtp } from "./fixtures/auth";

const createAnonClient = () =>
	createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
		auth: { persistSession: false },
	});

const passwordLoginRejectedMessage =
	"Die Anmeldung mit Passwort ist deaktiviert. Bitte melden Sie sich mit dem per E-Mail gesendeten Code an.";

describe("password login", () => {
	const givenEmail = `password-login-test+${randomUUID()}@ts.berlin`;
	const givenPassword = "SecurePassword123!";
	let userId: string;

	beforeAll(async () => {
		const { data, error } = await serviceRoleDbClient.auth.admin.createUser({
			email: givenEmail,
			password: givenPassword,
			email_confirm: true,
		});
		expect(error).toBeNull();
		userId = data.user.id;
	});

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(userId);
	});

	it("is rejected by the password_verification_attempt hook, even with the correct password", async () => {
		const { data, error } = await createAnonClient().auth.signInWithPassword({
			email: givenEmail,
			password: givenPassword,
		});

		expect(data.session).toBeNull();
		expect(error?.message).toBe(passwordLoginRejectedMessage);
	});

	it("does not block OTP login for the same user", async () => {
		const { data, error } = await signInWithOtp(createAnonClient(), givenEmail);

		expect(error).toBeNull();
		expect(data.session?.user.id).toBe(userId);
	});
});

/**
 * The hook only covers password logins, so a password signUp still goes through. That is
 * harmless: like OTP registration it only creates an unconfirmed user without a session,
 * and the password it stores can never be used to log in.
 */
describe("password signUp", () => {
	const givenEmail = `password-signup-test+${randomUUID()}@ts.berlin`;
	const givenPassword = "SecurePassword123!";
	let userId: string | undefined;

	afterAll(async () => {
		if (userId) {
			await serviceRoleDbClient.auth.admin.deleteUser(userId);
		}
	});

	it("creates an unconfirmed user without a session, whose password can never be used", async () => {
		const { data: signUpData, error: signUpError } =
			await createAnonClient().auth.signUp({
				email: givenEmail,
				password: givenPassword,
			});

		expect(signUpError).toBeNull();
		expect(signUpData.session).toBeNull();
		expect(signUpData.user?.email_confirmed_at).toBeUndefined();
		userId = signUpData.user?.id;

		// Stands in for confirming via the emailed code, which a real signup needs anyway.
		const { error: confirmError } =
			await serviceRoleDbClient.auth.admin.updateUserById(userId, {
				email_confirm: true,
			});
		expect(confirmError).toBeNull();

		const { data, error } = await createAnonClient().auth.signInWithPassword({
			email: givenEmail,
			password: givenPassword,
		});

		expect(data.session).toBeNull();
		expect(error?.message).toBe(passwordLoginRejectedMessage);
	});
});
