import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
	confirmOtp,
	findUserByEmail,
	testWithRegisteredUser,
} from "../fixtures/test-with-registered-user.ts";
import { supabaseAdminClient } from "../supabase.ts";
import { defaultUserFirstName, defaultUserLastName } from "../constants.ts";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { testWithoutSplashScreen } from "../fixtures/test-without-splash-screen.ts";
import Content from "../../src/content.ts";

test.describe("Login", () => {
	testWithRegisteredUser("User Login and Logout", async ({ page, account }) => {
		// Go to the login page
		await page.goto("/login/");

		// Fill in the email and password fields
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill(account.email);
		await page
			.getByRole("textbox", { name: "Passwort" })
			.fill(account.password);

		// Click on the "Anmelden" button
		await page.getByRole("button", { name: "Anmelden" }).click();

		// Check if we are on the main page
		await expect(
			page.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
			}),
		).toBeVisible();

		// Click on the drop-down button
		await page.getByRole("button", { name: "Profil öffnen" }).click();

		// Click on the log-out button
		await page.getByRole("button", { name: "Ausloggen" }).click();

		// Check if we are back on the landing page
		await expect(
			page.getByText("BärGPT, der KI-Assistent für die Berliner Verwaltung"),
		).toBeVisible();
	});

	test("Invalid Login Attempt", async ({ page }) => {
		// Go to the login page
		await page.goto("/login/");

		// Try to log in with empty fields
		await page.getByRole("button", { name: "Anmelden" }).click();

		// Email and Password fields should show validation errors
		await expect(
			page.getByText("Bitte füllen Sie dieses Feld").nth(0),
		).toBeVisible();
		await expect(
			page.getByText("Bitte füllen Sie dieses Feld").nth(1),
		).toBeVisible();

		// Fill in the email field with an invalid email format
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse Bitte füllen" })
			.fill("some-invalid-email");

		// Email field should show validation error
		await expect(page.getByText("Das E-Mail-Format ist falsch.")).toBeVisible();

		// Fill the password field with a too short password
		await page
			.getByRole("textbox", { name: "Passwort Passwort anzeigen" })
			.fill("1");

		// Password field should show validation error
		await expect(page.getByText("Das Passwort muss mindestens")).toBeVisible();

		// Fill in the email field with a valid email format, but not existing user
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse Das E-Mail-" })
			.fill("not-existing-user@ts.berlin");

		// Fill in the password field with a valid password, but not existing user
		await page
			.getByRole("textbox", { name: "Passwort Passwort anzeigen" })
			.fill("123456789!");

		// Logging in with valid email and password format, but non-existing user
		await page.getByRole("button", { name: "Anmelden" }).click();
		await expect(page.getByText("Benutzername oder Passwort")).toBeVisible();
	});
});

test.describe("Password Reset", () => {
	testWithRegisteredUser("Password Reset Flow", async ({ page, account }) => {
		const givenNewPassword = "!987654321";
		// Go to the login page
		await page.goto("/login/");

		// Check if we are on the login page
		await expect(
			page.getByRole("heading", { name: "Willkommen zurück" }),
		).toBeVisible();

		// click passwort vergessen
		await page.getByRole("link", { name: "Passwort vergessen?" }).click();

		// Check if we are on the reset password page
		await expect(
			page.getByRole("heading", { name: "Passwort vergessen?" }),
		).toBeVisible();

		// Fill in the email field
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill(account.email);

		// Click on the "Passwort zurücksetzen" button
		await page.getByRole("button", { name: "Zurücksetzen" }).click();

		// Check for the confirmation message
		await expect(
			page.getByText(
				"Wenn die E-Mail-Adresse registriert ist, senden wir Ihnen einen Link zum Zurücksetzen Ihres Passwortes.",
			),
		).toBeVisible();

		const page1 = await confirmOtp({ page, account });

		await expect(page1).toHaveURL("/reset-password/");

		await expect(
			page1.getByRole("heading", { name: "Passwort zurücksetzen" }),
		).toBeVisible();

		// Fill in the new password field
		await page1
			.getByRole("textbox", { name: "Neues Passwort Passwort" })
			.fill(givenNewPassword);
		await page1
			.getByRole("textbox", { name: "Neues Passwort wiederholen" })
			.fill(givenNewPassword);

		// Click on the "Passwort zurücksetzen" button
		await page1.getByRole("button", { name: "Passwort ändern" }).click();

		// Check for the confirmation message
		await expect(
			page1.getByText("Ihr Passwort wurde erfolgreich geändert."),
		).toBeVisible();

		// Click login
		await page1.getByRole("link", { name: "Zum Login" }).click();

		// Check if we are on the main page
		await expect(
			page1.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
			}),
		).toBeVisible();
	});

	test("Invalid request password reset link attempt", async ({ page }) => {
		await page.goto("/request-password-reset/");

		// Try to submit the form with empty fields
		await page.getByRole("button", { name: "Zurücksetzen" }).click();

		// Check for the validation errors
		await expect(page.getByText("Bitte füllen Sie dieses Feld")).toBeVisible();

		// Fill in the email field with an invalid email format
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill("invalid-email");

		// Try to submit the form
		await page.getByRole("button", { name: "Zurücksetzen" }).click();

		// Check for the validation error
		await expect(page.getByText("Das E-Mail-Format ist falsch.")).toBeVisible();
	});

	test("Invalid password reset Attempt", async ({ page }) => {
		await page.goto("/reset-password/");

		// Try to submit the form with empty fields
		await page.getByRole("button", { name: "Passwort ändern" }).click();

		// Check for the validation errors
		await expect(
			page.getByText("Bitte füllen Sie dieses Feld").nth(0),
		).toBeVisible();
		await expect(
			page.getByText("Bitte füllen Sie dieses Feld").nth(1),
		).toBeVisible();

		// Fill in the new password field with a too short password
		await page
			.getByRole("textbox", { name: "Neues Passwort Passwort" })
			.fill("1");

		// Fill in the password repeat field with a too short password
		await page
			.getByRole("textbox", { name: "Neues Passwort wiederholen" })
			.fill("1");

		// Try to submit the form
		await page.getByRole("button", { name: "Passwort ändern" }).click();

		// Check for the validation errors
		await expect(
			page.getByText("Das Passwort muss mindestens").nth(0),
		).toBeVisible();
		await expect(
			page.getByText("Das Passwort muss mindestens").nth(1),
		).toBeVisible();

		// Fill in the new password field with a valid password
		await page
			.getByRole("textbox", { name: "Neues Passwort Passwort" })
			.fill("123456789!");
		// Fill in the password reset field with a valid but different password
		await page
			.getByRole("textbox", { name: "Neues Passwort wiederholen" })
			.fill("123456789!0");

		// Try to submit the form
		await page.getByRole("button", { name: "Passwort ändern" }).click();

		// Check for the validation error
		await expect(page.getByText("Die Passwörter stimmen nicht")).toBeVisible();
	});
});

async function fillAndSubmitRegistrationForm(
	page: Page,
	{
		email,
		password,
		firstName,
		lastName,
	}: { email: string; password: string; firstName: string; lastName: string },
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

	const passwordInput = page.getByRole("textbox", {
		name: "Passwort",
		exact: true,
	});
	await passwordInput.fill(password);

	const passwordRepeatInput = page.getByRole("textbox", {
		name: "Passwort wiederholen",
	});
	await passwordRepeatInput.fill(password);

	const privacyCheckboxInput = page.locator(
		'[data-testid="label-has-accepted-privacy-checkbox"]',
	);
	await privacyCheckboxInput.check();

	// Wait for the registration request to complete
	await Promise.all([
		page.waitForResponse(
			(resp) => resp.url().includes("/auth/register") && resp.status() === 200,
		),
		page.getByRole("button", { name: "Registrieren" }).click(),
	]);
}

test.describe("User Registration (uses different user to prevent side-effects on other tests)", () => {
	// Unique per test so parallel workers never register the same email or have
	// one test's afterEach delete another's user. A worker runs its tests
	// serially, so a single module-scoped variable set in beforeEach is safe.
	let givenUserEmail: string;
	const givenUserPassword = "123456789!";
	const givenUserFirstName = "User";
	const givenUserLastName = "Registration";

	testWithoutSplashScreen.beforeEach(() => {
		givenUserEmail = `user.registration+${crypto.randomUUID()}@ts.berlin`;
	});

	testWithoutSplashScreen.afterEach(async () => {
		const foundUser = await findUserByEmail(givenUserEmail);

		expect(foundUser).toBeDefined();

		if (!foundUser) {
			throw new Error("User not found");
		}

		const { error: deleteUserError } =
			await supabaseAdminClient.auth.admin.deleteUser(foundUser.id);

		expect(deleteUserError).toBeNull();
	});

	testWithoutSplashScreen("Default Registration Flow", async ({ page }) => {
		await fillAndSubmitRegistrationForm(page, {
			email: givenUserEmail,
			password: givenUserPassword,
			firstName: givenUserFirstName,
			lastName: givenUserLastName,
		});

		// Info message about confirmation mail should be visible
		await expect(
			page.getByRole("heading", { name: "Fast geschafft!" }),
		).toBeVisible({ timeout: 10_000 });

		const page1 = await confirmOtp({
			page,
			account: {
				email: givenUserEmail,
				password: givenUserPassword,
				id: "", // id is not needed for this flow
			},
		});

		await expect(page1).toHaveURL("/");

		await expect(
			page1.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${givenUserFirstName} ${givenUserLastName}`,
			}),
		).toBeVisible();
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
				password: givenUserPassword,
				firstName: givenUserFirstName,
				lastName: givenUserLastName,
			});

			// The uniform "check your email" screen must be shown -
			// never an error revealing that the account already exists.
			await expect(
				page.getByRole("heading", {
					name: "Fast geschafft!",
				}),
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
				password: givenUserPassword,
				firstName: givenUserFirstName,
				lastName: givenUserLastName,
			});

			// Behaviorally indistinguishable from the "new user" case from the UI -
			// that's expected, the whole point is uniformity.
			await expect(
				page.getByRole("heading", {
					name: "Fast geschafft!",
				}),
			).toBeVisible({ timeout: 10_000 });
			await expect(
				page.getByText("Benutzer ist bereits registriert."),
			).not.toBeVisible();
		},
	);

	testWithoutSplashScreen(
		"Resend button re-submits the registration endpoint with just the email",
		async ({ page }) => {
			await fillAndSubmitRegistrationForm(page, {
				email: givenUserEmail,
				password: givenUserPassword,
				firstName: givenUserFirstName,
				lastName: givenUserLastName,
			});

			await expect(
				page.getByRole("heading", {
					name: "Fast geschafft!",
				}),
			).toBeVisible({ timeout: 10_000 });

			const resendButton = page.getByRole("button", {
				name: "E-Mail erneut senden",
			});

			const [resendRequest] = await Promise.all([
				page.waitForRequest(
					(request) =>
						request.url().includes("/auth/register") &&
						request.method() === "POST",
				),
				resendButton.click(),
			]);

			expect(resendRequest.postDataJSON()).toEqual({ email: givenUserEmail });

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

	testWithRegisteredUser.beforeEach(async ({ account }) => {
		await banUser(account.id);
	});

	testWithRegisteredUser.afterEach(async ({ account }) => {
		await unbanUser(account.id);
	});

	testWithRegisteredUser(
		"Logged-In User should be logged out when their account is banned",
		async ({ page, account, baseURL }) => {
			// Go to the login page
			await page.goto("/login/");

			// Try to log-in
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page
				.getByRole("textbox", { name: "Passwort" })
				.fill(account.password);
			await page.getByRole("button", { name: "Anmelden" }).click();

			// Check if we are still on the login page with the error message
			// Note: order matters here, we need to wait for the Text to be visible before checking the URL.
			await expect(
				page.getByText("Der Benutzeraccount wurde gesperrt."),
			).toBeVisible();
			await expect(page).toHaveURL(`${baseURL}/login/`);

			// Unban the user account in the database
			await unbanUser(account.id);

			// Refresh the page to clear the error message
			await page.goto("/");
			await expect(
				page.getByText("Der Benutzeraccount wurde gesperrt."),
			).not.toBeVisible();
			await expect(page).toHaveURL(`${baseURL}/`);

			// Go to the login page again
			await page.getByRole("link", { name: "Zur Login-Seite" }).click();

			// Log in again with the same credentials
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page
				.getByRole("textbox", { name: "Passwort" })
				.fill(account.password);
			await page.getByRole("button", { name: "Anmelden" }).click();

			// Check if we are on the main page again
			await expect(
				page.getByRole("heading", {
					name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
				}),
			).toBeVisible();

			// Ban the user account again in the database
			await banUser(account.id);

			// Refresh the page
			await page.goto("/");

			// Check if we are redirected to the landing page
			await expect(
				page.getByRole("heading", {
					name: "BärGPT, der KI-Assistent für die Berliner Verwaltung",
				}),
			).toBeVisible();

			// Go to the login page again
			await page.getByRole("link", { name: "Zur Login-Seite" }).click();

			// Check if we are on the login page
			await expect(page).toHaveURL(`${baseURL}/login/`);

			// Try to log-in again
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page
				.getByRole("textbox", { name: "Passwort" })
				.fill(account.password);
			await page.getByRole("button", { name: "Anmelden" }).click();

			// Check if we are still on the login page with the error message
			// Note: order matters here, we need to wait for the Text to be visible before checking the URL.
			await expect(
				page.getByText("Der Benutzeraccount wurde gesperrt."),
			).toBeVisible();
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

		const homePageHeader = page1.getByRole("heading", {
			name: "Willkommen bei BärGPT,",
		});
		await expect(homePageHeader).toBeVisible();
	},
);
