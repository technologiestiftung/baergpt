import { Session } from "@supabase/supabase-js";
import { supabaseAdminClient } from "../supabase.ts";
import { signInWithOtp } from "../auth.ts";
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
				const session = await signInWithOtp(adminAccount.email);

				await use(session);
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
			async ({}, use, testInfo) => {
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
			async ({}, use, testInfo) => {
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
