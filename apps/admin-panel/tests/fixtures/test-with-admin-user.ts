import { test as baseTest } from "@playwright/test";
import { supabaseAdminClient } from "../supabase.ts";

const ADMIN_PASSWORD = "password123";

type AdminAccount = {
	email: string;
	password: string;
	id: string;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional empty test fixtures
type AdminTestFixtures = {};

type AdminWorkerFixtures = {
	adminAccount: AdminAccount;
};

export const testWithAdminUser = baseTest.extend<
	AdminTestFixtures,
	AdminWorkerFixtures
>({
	adminAccount: [
		async ({}, use, workerInfo) => {
			const email = `domain-admin+${workerInfo.workerIndex}+${workerInfo.project.name}@ts.berlin`;

			const { data: existingUsers, error: listUsersError } =
				await supabaseAdminClient.auth.admin.listUsers({ perPage: 1000 });
			baseTest.expect(listUsersError).toBeNull();

			const existingUser = existingUsers?.users.find(
				(user) => user.email === email,
			);
			if (existingUser) {
				const { error: deleteExistingError } =
					await supabaseAdminClient.auth.admin.deleteUser(existingUser.id);
				baseTest.expect(deleteExistingError).toBeNull();
			}

			const { data, error: createUserError } =
				await supabaseAdminClient.auth.admin.createUser({
					email,
					password: ADMIN_PASSWORD,
					email_confirm: true,
					user_metadata: {
						first_name: "Domain",
						last_name: "Admin",
					},
				});

			baseTest.expect(createUserError).toBeNull();

			if (createUserError) {
				throw createUserError;
			}

			baseTest.expect(data.user).toBeDefined();

			if (!data.user) {
				throw new Error("Failed to create admin user: missing user id");
			}

			const id = data.user.id;

			const { error: adminError } = await supabaseAdminClient
				.from("application_admins")
				.insert([{ user_id: id }]);

			baseTest.expect(adminError).toBeNull();

			await use({ email, password: ADMIN_PASSWORD, id });

			const { error: deleteUserError } =
				await supabaseAdminClient.auth.admin.deleteUser(id);
			if (deleteUserError?.message !== "User not found") {
				testWithAdminUser.expect(deleteUserError).toBeNull();
			}
		},
		{ scope: "worker" },
	],
});
