import { Session } from "@supabase/supabase-js";
import { authStorageKey } from "../supabase.ts";
import {
	signInWithOtp,
	testWithRegisteredUser,
} from "./test-with-registered-user.ts";

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
				const { email } = account;

				const session = await signInWithOtp(email);

				/**
				 * This runs the test that uses this fixture (and injects the session).
				 */
				await use(session);
			},
			{ scope: "test", auto: true },
		],

		page: async ({ page, session }, use) => {
			/**
			 * This happens before each test that uses this fixture.
			 */
			await page.addInitScript(
				({ key, givenSession }) => {
					window.localStorage.setItem(key, JSON.stringify(givenSession));
				},
				{ key: authStorageKey, givenSession: session },
			);

			/**
			 * This runs the test that uses this fixture (and injects the page with data in the localStorage).
			 */
			await use(page);
		},
	});
