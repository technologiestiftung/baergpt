import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../index";
import { createClient, type Session } from "@supabase/supabase-js";
import { serviceRoleDbClient } from "../../supabase";
import type { Database } from "@repo/db-schema";
import { config } from "../../config";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("basic auth middleware", () => {
	it("GET * should return a 401 Unauthorized response", async () => {
		const response = await app.request("http://localhost:3000/", {
			method: "GET",
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Unauthorized: Invalid or expired session",
		});
	});

	describe("with valid session", () => {
		const givenUserEmail = "basic-auth-test-suite-user@ts.berlin";
		const givenUserPassword = "SecurePassword123!";

		let session: Session | null = null;

		beforeEach(async () => {
			const { data, error: signUpError } =
				await serviceRoleDbClient.auth.admin.createUser({
					email: givenUserEmail,
					password: givenUserPassword,
					email_confirm: true,
				});

			expect(signUpError).toBeNull();
			expect(data).toBeDefined();

			const { data: sessionData, error: signInError } =
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});
			expect(signInError).toBeNull();
			expect(sessionData).toBeDefined();

			session = sessionData.session;
		});

		afterEach(async () => {
			// The "deleted user" test below deletes the user itself, so this
			// cleanup tolerates only that specific case — any other error should
			// still fail the test.
			const { error: deleteUserError } =
				await serviceRoleDbClient.auth.admin.deleteUser(session.user.id);

			if (deleteUserError && deleteUserError.code !== "user_not_found") {
				throw deleteUserError;
			}
		});

		it("GET / should return a 404 Not Found response with valid session", async () => {
			const response = await app.request("http://localhost:3000/", {
				method: "GET",
				headers: new Headers({
					authorization: `Bearer ${session.access_token}`,
				}),
			});

			const actualResponse = await response.text();
			const expectedResponse = "404 Not Found";

			expect(response.status).toBe(404);
			expect(actualResponse).toStrictEqual(expectedResponse);
		});

		it("GET / should return a 401 Unauthorized response with valid session but banned user", async () => {
			const { error } = await serviceRoleDbClient.auth.admin.updateUserById(
				session.user.id,
				{
					ban_duration: "876000h", // 100 years
				},
			);

			expect(error).toBeNull();

			const response = await app.request("http://localhost:3000/", {
				method: "GET",
				headers: new Headers({
					authorization: `Bearer ${session.access_token}`,
				}),
			});

			const actualResponse = await response.json();
			const expectedResponse = {
				error: "Unauthorized: Invalid or expired session",
			};

			expect(response.status).toBe(401);
			expect(actualResponse).toStrictEqual(expectedResponse);
		});

		it("GET / should return a 401 Unauthorized response with valid session but deleted user", async () => {
			const { error } = await serviceRoleDbClient.auth.admin.deleteUser(
				session.user.id,
			);

			expect(error).toBeNull();

			// Reuse the pre-delete access token — simulates a still-valid token
			// for an account that has since been deleted.
			const response = await app.request("http://localhost:3000/", {
				method: "GET",
				headers: new Headers({
					authorization: `Bearer ${session.access_token}`,
				}),
			});

			const actualResponse = await response.json();
			const expectedResponse = {
				error: "Unauthorized: Invalid or expired session",
			};

			expect(response.status).toBe(401);
			expect(actualResponse).toStrictEqual(expectedResponse);
		});
	});
});
