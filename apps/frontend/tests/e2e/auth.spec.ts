import { expect, test } from "@playwright/test";
import { testWithRegisteredUser } from "../fixtures/test-with-registered-user.ts";
import { supabaseAdminClient } from "../supabase.ts";
import { defaultUserFirstName, defaultUserLastName } from "../constants.ts";

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

		// Check if we are back on the login page
		await expect(page.getByText("Willkommen zurückBitte melden")).toBeVisible();
	});

	test("Invalid Login Attempt", async ({ page }) => {
		// Go to the login page
		await page.goto("/login/");

		// Try to log in with empty fields
		await page
			.getByRole("button", { name: "Anmelden Ein weißer Pfeil" })
			.click();

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
			.getByRole("textbox", { name: "Passwort Password anzeigen" })
			.fill("1");

		// Password field should show validation error
		await expect(page.getByText("Das Passwort muss mindestens")).toBeVisible();

		// Fill in the email field with a valid email format, but not existing user
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse Das E-Mail-" })
			.fill("not-existing-user@berlin.de");

		// Fill in the password field with a valid password, but not existing user
		await page
			.getByRole("textbox", { name: "Passwort Password anzeigen" })
			.fill("123456");

		// Logging in with valid email and password format, but non-existing user
		await page
			.getByRole("button", { name: "Anmelden Ein weißer Pfeil" })
			.click();
		await expect(page.getByText("Benutzername oder Passwort")).toBeVisible();
	});
});

testWithRegisteredUser(
	"Logged-in user cannot access account-activated page without invite parameters",
	async ({ page, account }) => {
		// Login as this user
		await page.goto("/login/");
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill(account.email);
		await page
			.getByRole("textbox", { name: "Passwort" })
			.fill(account.password);
		await page.getByRole("button", { name: "Anmelden" }).click();

		// Verify we're logged in
		await expect(
			page.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
			}),
		).toBeVisible();

		// Try to access account-activated page directly (should redirect to home)
		await page.goto("/account-activated/");

		// Should be redirected back to home page
		await expect(page).toHaveURL("/");
		await expect(
			page.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
			}),
		).toBeVisible();
	},
);

test.describe("Password Reset", () => {
	testWithRegisteredUser("Password Reset Flow", async ({ page, account }) => {
		const givenNewPassword = "654321";
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

		// Wait a bit for the email to be sent and processed
		await page.waitForTimeout(3000);

		await page.goto("http://localhost:54324/"); // Inbucket URL

		// Wait for the email to appear and click on the first (most recent) email
		await page.waitForTimeout(1000);
		const emailLinks = page.getByRole("link", {
			name: `Admin To: ${account.email}`,
		});
		await emailLinks.first().click();

		// Clicking on the link should open a new tab
		const popupEvent = page.waitForEvent("popup");
		await page
			.locator("#preview-html")
			.contentFrame()
			.getByRole("link", { name: "Neues Passwort vergeben" })
			.click();
		const page1 = await popupEvent;

		// Wait for the page to fully load
		await page1.waitForLoadState("networkidle");
		await page1.waitForTimeout(2000);

		// After clicking on the link, we should be redirected to the reset password page
		await expect(
			page1.getByRole("heading", { name: "Passwort zurücksetzen" }),
		).toBeVisible();

		// Fill in the new password field
		await page1
			.getByRole("textbox", { name: "Neues Passwort Ein Fragezeichen-" })
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

		// Log out again
		await page1.getByRole("button", { name: "Profil" }).click();
		await page1.getByRole("button", { name: "Ausloggen" }).click();

		// Now reset the password back to the original one

		// Check if we are on the login page
		await expect(
			page1.getByRole("heading", { name: "Willkommen zurück" }),
		).toBeVisible();

		// click passwort vergessen
		await page1.getByRole("link", { name: "Passwort vergessen?" }).click();

		// Check if we are on the reset password page
		await expect(
			page1.getByRole("heading", { name: "Passwort vergessen?" }),
		).toBeVisible();

		// Fill in the email field
		await page1
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill(account.email);

		// Click on the "Passwort zurücksetzen" button
		await page1.getByRole("button", { name: "Zurücksetzen" }).click();

		// Check for the confirmation message
		await expect(
			page1.getByText(
				"Wenn die E-Mail-Adresse registriert ist, senden wir Ihnen einen Link zum Zurücksetzen Ihres Passwortes.",
			),
		).toBeVisible();

		// Wait a bit for the email to be sent and processed
		await page1.waitForTimeout(3000);

		await page1.goto("http://localhost:54324/"); // Inbucket URL

		// Wait for the email to appear and click on the first (most recent) email
		await page1.waitForTimeout(1000);
		const emailLinksNew = page1.getByRole("link", {
			name: `Admin To: ${account.email}`,
		});
		await emailLinksNew.first().click();

		// Clicking on the link should open a new tab
		const popupEventNew = page1.waitForEvent("popup");
		await page1
			.locator("#preview-html")
			.contentFrame()
			.getByRole("link", { name: "Neues Passwort vergeben" })
			.click();
		const page2 = await popupEventNew;

		// Wait for the page to fully load
		await page2.waitForLoadState("networkidle");
		await page2.waitForTimeout(2000);

		// After clicking on the link, we should be redirected to the reset password page
		await expect(
			page2.getByRole("heading", { name: "Passwort zurücksetzen" }),
		).toBeVisible();

		// Fill in the new password field
		await page2
			.getByRole("textbox", { name: "Neues Passwort Ein Fragezeichen-" })
			.fill(account.password);
		await page2
			.getByRole("textbox", { name: "Neues Passwort wiederholen" })
			.fill(account.password);

		// Click on the "Passwort zurücksetzen" button
		await page2.getByRole("button", { name: "Passwort ändern" }).click();

		// Check for the confirmation message
		await expect(
			page2.getByText("Ihr Passwort wurde erfolgreich geändert."),
		).toBeVisible();

		// Click login
		await page2.getByRole("link", { name: "Zum Login" }).click();

		// Check if we are on the main page
		await expect(
			page2.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
			}),
		).toBeVisible();
	});

	test("Invalid request password reset link attempt", async ({ page }) => {
		await page.goto("/reset-password/");

		// Try to submit the form with empty fields
		await page
			.getByRole("button", { name: "Zurücksetzen Ein weißer Pfeil" })
			.click();

		// Check for the validation errors
		await expect(page.getByText("Bitte füllen Sie dieses Feld")).toBeVisible();

		// Fill in the email field with an invalid email format
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill("invalid-email");

		// Try to submit the form
		await page
			.getByRole("button", { name: "Zurücksetzen Ein weißer Pfeil" })
			.click();

		// Check for the validation error
		await expect(page.getByText("Das E-Mail-Format ist falsch.")).toBeVisible();
	});

	test("Invalid password reset Attempt", async ({ page }) => {
		await page.goto("/new-password/");

		// Try to submit the form with empty fields
		await page
			.getByRole("button", { name: "Passwort ändern Ein weißer" })
			.click();

		// Check for the validation errors
		await expect(
			page.getByText("Bitte füllen Sie dieses Feld").nth(0),
		).toBeVisible();
		await expect(
			page.getByText("Bitte füllen Sie dieses Feld").nth(1),
		).toBeVisible();

		// Fill in the new password field with a too short password
		await page.getByRole("textbox", { name: "Neues Passwort Ein" }).fill("1");

		// Fill in the password repeat field with a too short password
		await page
			.getByRole("textbox", { name: "Neues Passwort wiederholen" })
			.fill("1");

		// Try to submit the form
		await page
			.getByRole("button", { name: "Passwort ändern Ein weißer" })
			.click();

		// Check for the validation errors
		await expect(
			page.getByText("Das Passwort muss mindestens").nth(0),
		).toBeVisible();
		await expect(
			page.getByText("Das Passwort muss mindestens").nth(1),
		).toBeVisible();

		// Fill in the new password field with a valid password
		await page
			.getByRole("textbox", { name: "Neues Passwort Ein" })
			.fill("123456");
		// Fill in the password reset field with a valid but different password
		await page
			.getByRole("textbox", { name: "Neues Passwort wiederholen" })
			.fill("1234567");

		// Try to submit the form
		await page
			.getByRole("button", { name: "Passwort ändern Ein weißer" })
			.click();

		// Check for the validation error
		await expect(page.getByText("Die Passwörter stimmen nicht")).toBeVisible();
	});
});

test.describe("User Registration (uses different user to prevent side-effects on other tests)", () => {
	const givenUserEmail = "user.registration@berlin.de";
	const givenUserPassword = "123456";
	const givenUserFirstName = "User";
	const givenUserLastName = "Registration";

	const changedLastName = "ChangedLastName";

	test.afterEach(async () => {
		const { data: listUsersData, error: listUsersError } =
			await supabaseAdminClient.auth.admin.listUsers();

		expect(listUsersError).toBeNull();
		expect(listUsersData).toBeDefined();

		const foundUser = listUsersData.users.find(
			({ email }) => email === givenUserEmail,
		);

		expect(foundUser).toBeDefined();

		if (!foundUser) {
			throw new Error("User not found");
		}

		const { error: deleteUserError } =
			await supabaseAdminClient.auth.admin.deleteUser(foundUser.id);

		expect(deleteUserError).toBeNull();
	});

	test("User with invite link cannot access main page without completing account activation", async ({
		page,
	}) => {
		// invite user via mail
		const { error: inviteLinkError } =
			await supabaseAdminClient.auth.admin.inviteUserByEmail(givenUserEmail, {
				data: {
					first_name: givenUserFirstName,
					last_name: givenUserLastName,
				},
			});

		expect(inviteLinkError).toBeNull();

		// Open the invite link in mail inbucket
		await page.goto("http://localhost:54324/"); // Inbucket URL
		await page
			.getByRole("link", { name: `Admin To: ${givenUserEmail}` })
			.first()
			.click();

		// Clicking on the link should open a new tab
		const popupEvent = page.waitForEvent("popup");
		await page
			.locator("#preview-html")
			.contentFrame()
			.getByRole("link", { name: "Jetzt registrieren" })
			.click();
		const page1 = await popupEvent;

		// check that we are on the account activation page
		await page1.waitForLoadState("networkidle");
		await expect(page1).toHaveURL(/\/account-activated/);

		// User E-Mail should be mentioned at the top
		await expect(
			page1.getByRole("heading", { name: givenUserEmail }),
		).toBeVisible();

		// Try to access the main page by navigating directly to "/"
		await page1.goto("/");

		// Should be redirected back to account-activated page
		await expect(page1).toHaveURL(/\/account-activated/);
		await expect(
			page1.getByRole("heading", { name: givenUserEmail }),
		).toBeVisible();
	});

	test("Default Invite User Flow", async ({ page }) => {
		// invite user via mail
		const { error: inviteLinkError } =
			await supabaseAdminClient.auth.admin.inviteUserByEmail(givenUserEmail, {
				data: {
					first_name: givenUserFirstName,
					last_name: givenUserLastName,
				},
			});

		expect(inviteLinkError).toBeNull();

		// Open the invite link in mail inbucket
		await page.goto("http://localhost:54324/"); // Inbucket URL
		await page
			.getByRole("link", { name: `Admin To: ${givenUserEmail}` })
			.first()
			.click();

		// Clicking on the link should open a new tab
		const popupEvent = page.waitForEvent("popup");
		await page
			.locator("#preview-html")
			.contentFrame()
			.getByRole("link", { name: "Jetzt registrieren" })
			.click();
		const page1 = await popupEvent;

		// check that we are on the account activation page
		await page1.waitForLoadState("networkidle");
		await expect(page1).toHaveURL(/\/account-activated/);

		// User E-Mail should be mentioned at the top
		await expect(
			page1.getByRole("heading", { name: givenUserEmail }),
		).toBeVisible();

		// Fill in the invite completion form
		await page1.getByLabel("Anredekeine AngabeFrauHerr").selectOption("Frau");
		await page1
			.getByLabel("Titelkeine AngabeDr.Prof.Prof")
			.selectOption("Prof. Dr.");
		// first and last name should be prefilled. Testing for changing last name
		await page1
			.getByRole("textbox", { name: "Nachname" })
			.fill(changedLastName);
		await page1
			.getByRole("textbox", { name: "Passwort Ein Fragezeichen-" })
			.fill(givenUserPassword);
		await page1
			.getByRole("textbox", { name: "Passwort wiederholen Password" })
			.fill(givenUserPassword);
		// Check the checkbox
		await page1.getByTestId("label-has-accepted-privacy-checkbox").click();

		// Submit the invite completion form and wait for navigation to main page
		await page1
			.getByRole("button", { name: "Registrieren Ein weißer Pfeil" })
			.click();
		await page1.waitForURL("/");

		// After clicking on the link, we should be redirected to the main page
		await expect(
			page1.getByRole("heading", {
				name: `Willkommen bei BärGPT, Frau Prof. Dr. ${changedLastName}`,
			}),
		).toBeVisible();

		// logout user
		await page1.getByRole("button", { name: "Profil" }).click();
		await page1.getByRole("button", { name: "Ausloggen" }).click();
	});
});

testWithRegisteredUser.describe("User active/inactive", async () => {
	testWithRegisteredUser.beforeEach(async ({ account }) => {
		const { error } = await supabaseAdminClient
			.from("user_active_status")
			.update({ is_active: false, deleted_at: new Date().toISOString() })
			.eq("id", account.id);

		expect(error).toBeNull();
	});

	testWithRegisteredUser.afterEach(async ({ account }) => {
		const { error: setInactiveError } = await supabaseAdminClient
			.from("user_active_status")
			.update({ is_active: true, deleted_at: null })
			.eq("id", account.id);

		expect(setInactiveError).toBeNull();
	});

	testWithRegisteredUser(
		"Logged-In User should be logged out when their account is deactivated",
		async ({ page, account, baseURL }) => {
			// Go to the main page
			await page.goto("/");

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
				page.getByText("Der Benutzeraccount wurde deaktiviert."),
			).toBeVisible();
			await expect(page).toHaveURL(`${baseURL}/login/`);

			// Re-activate the user account in the database
			const { error: setActiveError } = await supabaseAdminClient
				.from("user_active_status")
				.update({ is_active: true, deleted_at: null })
				.eq("id", account.id);

			expect(setActiveError).toBeNull();

			// Refresh the page to clear the error message
			await page.goto("/");
			await expect(
				page.getByText("Der Benutzeraccount wurde deaktiviert."),
			).not.toBeVisible();
			await expect(page).toHaveURL(`${baseURL}/login/`);

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

			// De-activate the user account again in the database
			const { error: setInactiveError } = await supabaseAdminClient
				.from("user_active_status")
				.update({ is_active: false, deleted_at: new Date().toISOString() })
				.eq("id", account.id);

			expect(setInactiveError).toBeNull();

			// Refresh the page
			await page.goto("/");

			// Check if we are redirected to the login page with the error message
			// Note: order matters here, we need to wait for the Text to be visible before checking the URL.
			await expect(
				page.getByText("Der Benutzeraccount wurde deaktiviert."),
			).toBeVisible();
			await expect(page).toHaveURL(`${baseURL}/login/`);
		},
	);
});

testWithRegisteredUser(
	"should allow user to change email address",
	async ({ page, account }) => {
		// Login as this user
		await page.goto("/login/");
		await page
			.getByRole("textbox", { name: "E-Mail-Adresse" })
			.fill(account.email);
		await page
			.getByRole("textbox", { name: "Passwort" })
			.fill(account.password);
		await page.getByRole("button", { name: "Anmelden" }).click();

		// Verify we're logged in
		await expect(
			page.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
			}),
		).toBeVisible();

		// Go to the profile page
		await page.goto("/profile/");
		const updatedEmail = "john.doe@newemail.com";

		await expect(page.locator("#email")).toHaveValue(account.email);

		// Fill in the email field with new data
		await page.locator("#email").fill(updatedEmail);

		// Submit form
		await page.getByRole("button", { name: "E-Mail-Adresse ändern" }).click();

		// Check for the email change dialog
		await expect(
			page.getByRole("heading", {
				name: `Verifizierungs-E-Mail versendet an ${updatedEmail}`,
			}),
		).toBeVisible();

		// Close the email dialog
		await page.getByRole("button", { name: "E-Mail-Dialog schließen" }).click();

		// Check for info about email confirmation above input field
		await expect(
			page.getByText(
				`Sie haben die Änderung Ihrer E-Mail-Adresse auf ${updatedEmail} beantragt.`,
			),
		).toBeVisible();

		// Wait a bit for the email to be sent and processed
		await page.waitForTimeout(3000);

		await page.goto("http://localhost:54324/"); // Inbucket URL

		// Wait for the email to appear and click on the first (most recent) email
		await page.waitForTimeout(1000);
		const emailLinks = page.getByRole("link", {
			name: `Admin To: ${updatedEmail}`,
		});
		await emailLinks.first().click();

		// Clicking on the link should open a new tab
		const popupEvent = page.waitForEvent("popup");
		await page
			.locator("#preview-html")
			.contentFrame()
			.getByRole("link", { name: "Neue E-Mail-Adresse bestätigen" })
			.click();
		const page1 = await popupEvent;

		// Wait for the page to fully load
		await page1.waitForLoadState("networkidle");

		// After clicking on the link, we should be redirected to the email confirmation page
		await expect(
			page1.getByRole("heading", {
				name: "Ihre neue E-Mail-Adresse wurde erfolgreich geändert.",
			}),
		).toBeVisible();

		// check that we were redirected to the email-changed page
		await expect(page1).toHaveURL("/email-changed/#");

		// Go back to main page
		await page1
			.getByRole("link", { name: "Zu BärGPT Ein weißer Pfeil" })
			.click();

		// Check if we are on the main page
		await expect(
			page1.getByRole("heading", {
				name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
			}),
		).toBeVisible();

		// Go to the profile page
		await page.goto("/profile/");

		// Check that the email was updated
		await expect(page.locator("#email")).toHaveValue(updatedEmail);
	},
);
