import { Session } from "@supabase/supabase-js";
import { test as baseTest } from "@playwright/test";
import { supabaseAnonClient } from "../supabase.ts";
import { testWithRegisteredUser } from "./test-with-registered-user.ts";

type TestWithRegisteredUser = {
	session: Session;
};

export const testWithLoggedInUser =
	testWithRegisteredUser.extend<TestWithRegisteredUser>({
		session: [
			async ({ account }, use) => {
				/**
				 * This happens before each test that uses this fixture.
				 */
				const { email, password } = account;

				const { data, error } =
					await supabaseAnonClient.auth.signInWithPassword({
						email,
						password,
					});

				baseTest.expect(error).toBeNull();
				baseTest.expect(data).toBeDefined();

				if (error) {
					throw new Error(`Failed to sign in: ${error.message}`);
				}

				/**
				 * This runs the test that uses this fixture (and injects the session).
				 */
				await use(data.session);
			},
			{ scope: "test", auto: true },
		],

		page: async ({ page, session }, use) => {
			/**
			 * This happens before each test that uses this fixture.
			 */
			await page.addInitScript((session) => {
				window.localStorage.setItem(
					"sb-127-auth-token", // -> browser localStorage key used by a local supabase instance
					JSON.stringify(session),
				);
			}, session);

			/**
			 * This runs the test that uses this fixture (and injects the page with data in the localStorage).
			 */
			await use(page);
		},
	});
