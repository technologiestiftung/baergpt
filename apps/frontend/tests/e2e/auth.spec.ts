import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
	confirmOtp,
	testWithRegisteredUser,
} from "../fixtures/test-with-registered-user.ts";
import { supabaseAdminClient } from "../supabase.ts";
import { defaultUserFirstName, defaultUserLastName } from "../constants.ts";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { testWithoutSplashScreen } from "../fixtures/test-without-splash-screen.ts";
import Content from "../../src/content.ts";
import { expectGreeting } from "./helpers/greeting.ts";

/**
 * Passwordless login: enter the email, request a one-time code, then read the
 * code from Mailpit and submit it on the confirm-otp page. confirmOtp opens the
 * emailed link in a new tab and returns that (now authenticated) page.
 */
async function loginViaOtp(
	page: Page,
	account: { email: string; password: string; id: string },
) {
	await page.goto("/login/");
	await page
		.getByRole("textbox", { name: "E-Mail-Adresse" })
		.fill(account.email);
	await page.getByRole("button", { name: "Code anfordern" }).click();
	return confirmOtp({ page, account });
}

test.describe("Login", () => {
	testWithRegisteredUser("User Login and Logout", async ({ page, account }) => {
		const page1 = await loginViaOtp(page, account);

		// Check if we are on the main page
		await expectGreeting(
			page1,
			`${defaultUserFirstName} ${defaultUserLastName}`,
		);

		// Click on the drop-down button
		await page1.getByRole("button", { name: "Profil öffnen" }).click();

		// Click on the log-out button
		await page1.getByRole("button", { name: "Ausloggen" }).click();

		// Check if we are back on the landing page
		await expect(
			page1.getByText("BärGPT, der KI-Assistent für die Berliner Verwaltung"),
		).toBeVisible();
	});

	test("Invalid Login Attempt", async ({ page }) => {
		// Go to the login page
		await page.goto("/login/");

		// Try to request a code with an empty email field
		await page.getByRole("button", { name: "Code anfordern" }).click();

		// Email field should show a validation error
		await expect(page.getByText("Bitte füllen Sie dieses Feld")).toBeVisible();

		// Fill in the email field with an invalid email format
		await page.locator("#email").fill("some-invalid-email");

		// Try to request a code again
		await page.getByRole("button", { name: "Code anfordern" }).click();

		// Email field should show a format validation error
		await expect(page.getByText("Das E-Mail-Format ist falsch.")).toBeVisible();
	});

	test("Login with an unregistered email is indistinguishable from a registered one", async ({
		page,
	}) => {
		// Regression test: an unregistered email must navigate to /confirm-otp/
		// exactly like a registered one, so the login form can't be used to probe
		// which emails have accounts (see requestLoginOtp's otp_disabled handling).
		const nonExistentEmail = "nonexistent-login-attempt@ts.berlin";

		const { data: listUsersDataBefore, error: listUsersErrorBefore } =
			await supabaseAdminClient.auth.admin.listUsers();
		expect(listUsersErrorBefore).toBeNull();
		expect(
			listUsersDataBefore?.users.some(
				({ email }) => email === nonExistentEmail,
			),
		).toBe(false);

		await page.goto("/login/");
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill(nonExistentEmail);
		await page.getByRole("button", { name: "Code anfordern" }).click();

		await expect(page).toHaveURL(/\/confirm-otp\//);

		// shouldCreateUser:false must still hold — navigating must not have
		// silently created an account for the unregistered email.
		const { data: listUsersDataAfter, error: listUsersErrorAfter } =
			await supabaseAdminClient.auth.admin.listUsers();
		expect(listUsersErrorAfter).toBeNull();
		expect(
			listUsersDataAfter?.users.some(({ email }) => email === nonExistentEmail),
		).toBe(false);
	});

	test("Confirm-otp page reached via login shows the login-specific footer links", async ({
		page,
	}) => {
		// Regression test: the confirm-otp page tailors its "wrong email" /
		// "not registered" footer links based on the ?origin= param set by
		// login-page/register-page. Reaching it via login must never show the
		// "not yet registered" escape hatch. See confirm-otp/index.tsx.
		await page.goto("/login/");
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill("confirm-otp-footer-check@ts.berlin");
		await page.getByRole("button", { name: "Code anfordern" }).click();

		await expect(page).toHaveURL(/[?&]origin=login(&|$)/);
		await expect(
			page.getByRole("link", { name: "Zurück zum Login" }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Zurück zur Registrierung" }),
		).not.toBeVisible();
		await expect(
			page.getByRole("link", { name: "Zur Registrierung" }),
		).toBeVisible();
	});
});

async function fillAndSubmitRegistrationForm(
	page: Page,
	{
		email,
		firstName,
		lastName,
	}: { email: string; firstName: string; lastName: string },
) {
	await page.goto("/register/");

	const firstNameInput = page.getByRole("textbox", { name: "Vorname" });
	await firstNameInput.fill(firstName);

	const lastNameInput = page.getByRole("textbox", { name: "Nachname" });
	await lastNameInput.fill(lastName);

	const emailInput = page.getByRole("textbox", {
		name: "E-Mail-Adresse Nur",
	});
	await emailInput.fill(email);

	// Wait for check email allowed to be loaded before proceeding
	await page
		.waitForResponse((resp) => resp.url().includes("check_email_allowed"), {
			timeout: 10_000,
		})
		.catch(() => {}); // Ignore if already completed

	const privacyCheckboxInput = page.locator(
		'[data-testid="label-has-accepted-privacy-checkbox"]',
	);
	await privacyCheckboxInput.check();

	// Wait for the passwordless sign-up (OTP) request to complete
	await Promise.all([
		page.waitForResponse(
			(resp) => resp.url().includes("/auth/v1/otp") && resp.status() === 200,
		),
		page.getByRole("button", { name: "Registrieren" }).click(),
	]);
}

test.describe("User Registration (uses different user to prevent side-effects on other tests)", () => {
	const givenUserEmail = "user.registration@ts.berlin";
	const givenUserPassword = "123456789!";
	const givenUserFirstName = "User";
	const givenUserLastName = "Registration";

	testWithoutSplashScreen.afterEach(async () => {
		const { data: listUsersData, error: listUsersError } =
			await supabaseAdminClient.auth.admin.listUsers();

		expect(listUsersError).toBeNull();
		expect(listUsersData).toBeDefined();

		const foundUser = listUsersData.users.find(
			({ email }) => email === givenUserEmail,
		);

		// A brand-new registration might not have created the user yet if the OTP
		// was never confirmed; only delete when present.
		if (!foundUser) {
			return;
		}

		const { error: deleteUserError } =
			await supabaseAdminClient.auth.admin.deleteUser(foundUser.id);

		expect(deleteUserError).toBeNull();
	});

	testWithoutSplashScreen("Default Registration Flow", async ({ page }) => {
		await fillAndSubmitRegistrationForm(page, {
			email: givenUserEmail,
			firstName: givenUserFirstName,
			lastName: givenUserLastName,
		});

		const page1 = await confirmOtp({
			page,
			account: {
				email: givenUserEmail,
				password: givenUserPassword,
				id: "", // id is not needed for this flow
			},
		});

		await expect(page1).toHaveURL("/");

		await expectGreeting(page1, `${givenUserFirstName} ${givenUserLastName}`);
	});

	testWithoutSplashScreen(
		"Registering with an existing confirmed email shows the same generic screen",
		async ({ page }) => {
			const { error: createUserError } =
				await supabaseAdminClient.auth.admin.createUser({
					email: givenUserEmail,
					password: givenUserPassword,
					email_confirm: true,
				});

			expect(createUserError).toBeNull();

			await fillAndSubmitRegistrationForm(page, {
				email: givenUserEmail,
				firstName: givenUserFirstName,
				lastName: givenUserLastName,
			});

			// The uniform confirm-code screen must be shown -
			// never an error revealing that the account already exists.
			await expect(
				page.getByRole("heading", { name: "Fast geschafft!" }),
			).toBeVisible({ timeout: 10_000 });
			await expect(
				page.getByText("Benutzer ist bereits registriert."),
			).not.toBeVisible();
		},
	);

	testWithoutSplashScreen(
		"Registering with an existing unconfirmed email shows the same generic screen",
		async ({ page }) => {
			const { error: createUserError } =
				await supabaseAdminClient.auth.admin.createUser({
					email: givenUserEmail,
					password: givenUserPassword,
					email_confirm: false,
				});

			expect(createUserError).toBeNull();

			await fillAndSubmitRegistrationForm(page, {
				email: givenUserEmail,
				firstName: givenUserFirstName,
				lastName: givenUserLastName,
			});

			// Behaviorally indistinguishable from the "new user" case from the UI -
			// that's expected, the whole point is uniformity.
			await expect(
				page.getByRole("heading", { name: "Fast geschafft!" }),
			).toBeVisible({ timeout: 10_000 });
			await expect(
				page.getByText("Benutzer ist bereits registriert."),
			).not.toBeVisible();
		},
	);

	testWithoutSplashScreen(
		"Resend button re-requests a one-time code with just the email",
		async ({ page }) => {
			await fillAndSubmitRegistrationForm(page, {
				email: givenUserEmail,
				firstName: givenUserFirstName,
				lastName: givenUserLastName,
			});

			// Registration navigates straight to the confirm-code screen.
			await expect(
				page.getByRole("heading", { name: "Fast geschafft!" }),
			).toBeVisible({ timeout: 10_000 });

			const resendButton = page.getByRole("button", {
				name: "E-Mail erneut senden",
			});

			const [resendRequest] = await Promise.all([
				page.waitForRequest(
					(request) =>
						request.url().includes("/auth/v1/otp") &&
						request.method() === "POST",
				),
				resendButton.click(),
			]);

			expect(resendRequest.postDataJSON().email).toEqual(givenUserEmail);

			await expect(
				page.getByText(Content["unconfirmedEmail.resend.success"]),
			).toBeVisible();
		},
	);
});

testWithoutSplashScreen(
	"Try to register with not allowed user",
	async ({ page }) => {
		// Go to the registration page
		await page.goto("/register/");

		// Wait for check email allowed to be loaded before proceeding
		const emailAllowedCheck = page
			.waitForResponse((resp) => resp.url().includes("check_email_allowed"), {
				timeout: 10_000,
			})
			.catch(() => {}); // Ignore if already completed

		const emailInput = page.getByRole("textbox", {
			name: "E-Mail-Adresse Nur",
		});
		await emailInput.click();
		await emailInput.pressSequentially("not-allowed@example.com");
		await emailInput.blur();

		await emailAllowedCheck;

		const errorMessage = page.getByText(
			"E-Mail nicht zulässig. Bei Fragen support@baergpt.berlin kontaktieren.",
		);
		await expect(errorMessage).toBeVisible();
	},
);

testWithRegisteredUser.describe("User ban", async () => {
	async function banUser(userId: string) {
		const { error } = await supabaseAdminClient.auth.admin.updateUserById(
			userId,
			{
				ban_duration: "876000h", // 100 years
			},
		);

		expect(error).toBeNull();
	}

	async function unbanUser(userId: string) {
		const { error } = await supabaseAdminClient.auth.admin.updateUserById(
			userId,
			{
				ban_duration: "none",
			},
		);

		expect(error).toBeNull();
	}

	testWithRegisteredUser.afterEach(async ({ account }) => {
		await unbanUser(account.id);
	});

	testWithRegisteredUser(
		"Logged-in user is logged out when their account is banned",
		async ({ page, account, baseURL }) => {
			// Log in via OTP while the account is active.
			const page1 = await loginViaOtp(page, account);
			await expectGreeting(
				page1,
				`${defaultUserFirstName} ${defaultUserLastName}`,
			);

			// Ban the user account in the database.
			await banUser(account.id);

			// On the next navigation the app detects the ban and logs the user out.
			await page1.goto("/");
			await expect(
				page1.getByRole("heading", {
					name: "BärGPT, der KI-Assistent für die Berliner Verwaltung",
				}),
			).toBeVisible();

			// Unban and confirm the user can log in again via a fresh OTP.
			await unbanUser(account.id);

			const page2 = await loginViaOtp(page1, account);
			await expectGreeting(
				page2,
				`${defaultUserFirstName} ${defaultUserLastName}`,
			);
			await expect(page2).toHaveURL(`${baseURL}/`);
		},
	);
});

testWithLoggedInUser(
	"should allow user to change email address",
	async ({ page, account }) => {
		const updatedEmail = "john.doe@polizei.berlin.de";
		const updatedAccount = {
			...account,
			email: updatedEmail,
		};

		await page.goto("/profile/");
		// Wait for allowed email domains to be loaded before filling the form
		await page
			.waitForResponse(
				(resp) => resp.url().includes("get_allowed_email_domains"),
				{ timeout: 10000 },
			)
			.catch(() => {}); // Ignore if already completed

		await expect(page.locator("#email")).toHaveValue(account.email);

		// Fill in the email field with new data
		await page.locator("#email").fill(updatedEmail);

		const submitEmailChangeButton = page.getByRole("button", {
			name: "E-Mail-Adresse ändern",
		});
		await submitEmailChangeButton.click();

		const confirmationModal = page.getByRole("heading", {
			name: "Verifizierungs-E-Mail",
		});
		await expect(confirmationModal).toBeVisible();

		const closeConfirmationModal = page.getByRole("button", {
			name: "E-Mail-Dialog schließen",
		});
		await closeConfirmationModal.click();

		const emailChangeInfo = page.getByText("Sie haben die Änderung Ihrer");
		await expect(emailChangeInfo).toBeVisible();

		const page1 = await confirmOtp({ page, account: updatedAccount });

		const emailChangeSuccessfulPage = page1.getByRole("heading", {
			name: "Ihre neue E-Mail-Adresse",
		});
		await expect(emailChangeSuccessfulPage).toBeVisible();

		const linkToBaerGPTHomePage = page1.getByRole("link", {
			name: "Zu BärGPT",
		});
		await linkToBaerGPTHomePage.click();

		await expectGreeting(
			page1,
			`${defaultUserFirstName} ${defaultUserLastName}`,
		);
	},
);
