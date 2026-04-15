import {
	defaultUserFirstName,
	defaultUserLastName,
	defaultUserPassword,
	defaultUserEmail,
} from "../constants.ts";
import { Page, expect } from "@playwright/test";
import { supabaseAdminClient } from "../supabase.ts";
import { testWithoutSplashScreen } from "./test-without-splash-screen.ts";

type TestWithRegisteredUser = {
	account: {
		email: string;
		password: string;
		id: string;
	};
};

export const testWithRegisteredUser =
	testWithoutSplashScreen.extend<TestWithRegisteredUser>({
		account: [
			async ({}, use) => {
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

				testWithoutSplashScreen.expect(createUserError).toBeNull();
				testWithoutSplashScreen.expect(data).toBeDefined();

				if (createUserError) {
					throw new Error(`Failed to create user: ${createUserError.message}`);
				}

				const id = data.user.id;

				const { error: activationError } = await supabaseAdminClient
					.from("user_active_status")
					.update({ registration_finished_at: new Date().toISOString() })
					.eq("id", id);

				testWithoutSplashScreen.expect(activationError).toBeNull();

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

export async function confirmOtp({
	page,
	account,
}: {
	page: Page;
	account: TestWithRegisteredUser["account"];
}) {
	await page.goto("http://localhost:54324/"); // Inbucket URL

	// Wait for the email to appear and click on the first (most recent) email
	await page.waitForTimeout(3_000);

	const emailLinks = page.getByRole("link", {
		name: `Admin To: ${account.email}`,
	});
	await emailLinks.first().click();

	// Confirm via OTP flow
	const popupEvent = page.waitForEvent("popup");
	const emailFrame = await page.locator("#preview-html").contentFrame();
	if (!emailFrame) {
		throw new Error("Email preview frame not available");
	}

	const recoveryOtp = (
		await emailFrame
			.locator("p")
			.filter({ hasText: /^\d{6}$/ })
			.first()
			.innerText()
	).trim();

	await emailFrame.getByRole("link", { name: /Identität bestätigen/ }).click();

	const page1 = await popupEvent;

	await page1.waitForLoadState("networkidle");
	await page1.waitForTimeout(2000);

	await expect(
		page1.getByRole("heading", { name: "Aktion bestätigen" }),
	).toBeVisible();

	await page1
		.getByRole("textbox", { name: "Sicherheitscode" })
		.fill(recoveryOtp);
	await page1.getByRole("button", { name: "Weiter" }).click();

	return page1;
}
