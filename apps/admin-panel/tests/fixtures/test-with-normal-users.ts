import { testWithLoggedInAdminUser as test } from "./test-with-logged-in-admin-user.ts";
import { supabaseAdminClient } from "../supabase.ts";
import { expect } from "@playwright/test";

const USER_PASSWORD = "password123";

type TestUser = { id: string; email: string };
type UserManagementFixtures = { testUser: TestUser };

export const testWithUser = test.extend<UserManagementFixtures>({
	testUser: [
		async ({}, use, testInfo) => {
			const user = await createTestUser(
				testInfo.workerIndex,
				testInfo.project.name,
				"mgmt",
			);
			await use(user);
			await deleteTestUser(user.id);
		},
		{ scope: "test" },
	],
});

async function createTestUser(
	workerIndex: number,
	projectName: string,
	suffix: string,
) {
	const email = `e2e-user-${suffix}+${workerIndex}+${projectName}@ts.berlin`;

	// Clean up any leftover from a previous run
	const { data: existing } = await supabaseAdminClient.auth.admin.listUsers({
		perPage: 1000,
	});
	const existingUser = existing?.users.find((u) => u.email === email);
	if (existingUser) {
		await supabaseAdminClient.auth.admin.deleteUser(existingUser.id);
	}

	const { data, error } = await supabaseAdminClient.auth.admin.createUser({
		email,
		password: USER_PASSWORD,
		email_confirm: true,
		user_metadata: { first_name: "Test", last_name: suffix },
	});

	expect(error).toBeNull();
	if (!data.user) {
		throw new Error("Failed to create test user");
	}

	return { id: data.user.id, email };
}

async function deleteTestUser(id: string) {
	const { error } = await supabaseAdminClient.auth.admin.deleteUser(id);
	// Ignore "User not found" – the test may have deleted the user itself
	if (error && error.message !== "User not found") {
		expect(error).toBeNull();
	}
}
