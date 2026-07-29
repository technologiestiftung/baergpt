import { Session } from "@supabase/supabase-js";
import { test as baseTest } from "@playwright/test";
import { supabaseAnonClient, supabaseAdminClient } from "../supabase.ts";
import { testWithAdminUser } from "./test-with-admin-user.ts";

type TestWithLoggedInAdminUser = {
	session: Session;
	testDomain: string;
	testEmail: string;
};

export const testWithLoggedInAdminUser =
	testWithAdminUser.extend<TestWithLoggedInAdminUser>({
		session: [
			async ({ adminAccount }, use) => {
				const { email, password } = adminAccount;

				const { data, error } =
					await supabaseAnonClient.auth.signInWithPassword({
						email,
						password,
					});

				baseTest.expect(error).toBeNull();
				baseTest.expect(data).toBeDefined();

				if (error) {
					throw new Error(`Failed to sign in as admin: ${error.message}`);
				}

				await use(data.session);
			},
			{ scope: "test", auto: true },
		],

		page: async ({ page, session }, use) => {
			await page.addInitScript((givenSession) => {
				window.localStorage.setItem(
					"sb-127-auth-token", // -> browser localStorage key used by a local supabase instance
					JSON.stringify(givenSession),
				);
			}, session);

			await use(page);
		},

		testDomain: [
			async (_, use, testInfo) => {
				const domain = `e2e-${testInfo.project.name}-${testInfo.workerIndex}.berlin.de`;

				await use(domain);

				const { error } = await supabaseAdminClient
					.from("allowed_email_domains")
					.delete()
					.eq("domain", domain);
				testWithAdminUser.expect(error).toBeNull();
			},
			{ scope: "test" },
		],

		testEmail: [
			async (_, use, testInfo) => {
				const email = `e2e-${testInfo.project.name}-${testInfo.workerIndex}@extern-test.de`;

				await use(email);

				const { error } = await supabaseAdminClient
					.from("allowed_individual_emails")
					.delete()
					.eq("email", email);

				testWithAdminUser.expect(error).toBeNull();
			},
			{ scope: "test" },
		],
	});
