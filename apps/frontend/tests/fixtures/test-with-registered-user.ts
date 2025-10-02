import {
	defaultUserFirstName,
	defaultUserLastName,
	defaultUserPassword,
	defaultUserEmail,
} from "../constants.ts";
import { test as baseTest } from "@playwright/test";
import { supabaseAdminClient } from "../supabase.ts";

type TestWithRegisteredUser = {
	account: {
		email: string;
		password: string;
		id: string;
	};
};

export const testWithRegisteredUser = baseTest.extend<TestWithRegisteredUser>({
	account: [
		async (_, use) => {
			/**
			 * This happens before each test that uses this fixture.
			 */
			const email = defaultUserEmail;

			const { data, error: createUserError } =
				await supabaseAdminClient.auth.admin.createUser({
					email,
					password: defaultUserPassword,
					email_confirm: true,
					user_metadata: {
						first_name: defaultUserFirstName,
						last_name: defaultUserLastName,
					},
				});

			baseTest.expect(createUserError).toBeNull();
			baseTest.expect(data).toBeDefined();

			if (createUserError) {
				throw new Error(`Failed to create user: ${createUserError.message}`);
			}

			const id = data.user.id;

			const { error: activationError } = await supabaseAdminClient
				.from("user_active_status")
				.update({ registration_finished_at: new Date().toISOString() })
				.eq("id", id);

			baseTest.expect(activationError).toBeNull();

			/**
			 * This runs the test that uses this fixture (and injects the account).
			 */
			await use({ email, password: defaultUserPassword, id });

			/**
			 * This happens after each test that uses this fixture.
			 */
			await cleanup(id);
		},
		{ scope: "test", auto: true },
	],
});

async function cleanup(id: string) {
	const { error: deleteUserError } =
		await supabaseAdminClient.auth.admin.deleteUser(id);
	// Ignore "User not found" error as it means the user was already deleted
	if (deleteUserError?.message !== "User not found") {
		testWithRegisteredUser.expect(deleteUserError).toBeNull();
	}
}
