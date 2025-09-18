import { expect, Page } from "@playwright/test";
import { testWithRegisteredUser } from "../fixtures/test-with-registered-user.ts";
import { defaultUserFirstName, defaultUserLastName } from "../constants.ts";

// helper to open profile page on any viewport
async function openProfile(page: Page) {
	await page.getByRole("button", { name: "Profil öffnen" }).click();
	await page.goto("/profile/");
	await expect(page).toHaveURL("/profile/");
}

testWithRegisteredUser.describe("Password Change Feature", () => {
	testWithRegisteredUser(
		"Successful password change flow",
		async ({ page, account }) => {
			const newPassword = "newPassword123";

			// Login
			await page.goto("/login/");
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page
				.getByRole("textbox", { name: "Passwort" })
				.fill(account.password);
			await page.getByRole("button", { name: "Anmelden" }).click();
			// Ensure redirect to home happened before asserting heading
			await expect(page).toHaveURL("/");

			// Verify we're logged in
			await expect(
				page.getByRole("heading", {
					name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
				}),
			).toBeVisible();

			// Navigate to profile
			await openProfile(page);

			// Fill in password change form
			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill(account.password);
			await page.locator("#password").fill(newPassword);
			await page.locator("#repeatPassword").fill(newPassword);

			// Submit the form
			await page
				.getByRole("button", { name: "Passwort aktualisieren" })
				.click();

			// Verify success toast
			await expect(page.getByText("Passwort wurde aktualisiert")).toBeVisible();

			// Logout - navigate to home page then open profile drawer
			await page.goto("/");
			await expect(page).toHaveURL("/");
			await page.getByRole("button", { name: "Profil öffnen" }).click();
			await page.getByRole("button", { name: "Ausloggen" }).click();

			// Try to login with new password
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page.getByRole("textbox", { name: "Passwort" }).fill(newPassword);
			await page.getByRole("button", { name: "Anmelden" }).click();
			await expect(page).toHaveURL("/");

			// Verify we can login with new password
			await expect(
				page.getByRole("heading", {
					name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
				}),
			).toBeVisible();

			// Change password back to original (cleanup)
			await openProfile(page);

			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill(newPassword);
			await page.locator("#password").fill(account.password);
			await page.locator("#repeatPassword").fill(account.password);

			await page
				.getByRole("button", { name: "Passwort aktualisieren" })
				.click();

			await expect(page.getByText("Passwort wurde aktualisiert")).toBeVisible();
		},
	);

	testWithRegisteredUser(
		"Password validation errors",
		async ({ page, account }) => {
			// Login and navigate to profile
			await page.goto("/login/");
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page
				.getByRole("textbox", { name: "Passwort" })
				.fill(account.password);
			await page.getByRole("button", { name: "Anmelden" }).click();
			await expect(page).toHaveURL("/");

			await openProfile(page);

			// Test 1: Passwords don't match
			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill(account.password);
			await page.locator("#password").fill("password123");
			await page.locator("#repeatPassword").fill("password456");

			// Verify error message appears
			await expect(
				page.getByText("Die Passwörter stimmen nicht überein."),
			).toBeVisible();

			// Verify submit button is disabled
			await expect(
				page.getByRole("button", { name: "Passwort aktualisieren" }),
			).toBeDisabled();

			// Clear fields
			await page.getByRole("textbox", { name: "Aktuelles Passwort" }).clear();
			await page.locator("#password").clear();
			await page.locator("#repeatPassword").clear();

			// Test 2: New password same as current
			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill(account.password);
			await page.locator("#password").fill(account.password);
			await page.locator("#repeatPassword").fill(account.password);

			// Verify error message
			await expect(
				page.getByText(
					"Das neue Passwort muss sich vom alten Passwort unterscheiden.",
				),
			).toBeVisible();

			// Clear fields
			await page.getByRole("textbox", { name: "Aktuelles Passwort" }).clear();
			await page.locator("#password").clear();
			await page.locator("#repeatPassword").clear();

			// Test 3: Wrong current password
			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill("wrongpassword");
			await page.locator("#password").fill("newpassword123");
			await page.locator("#repeatPassword").fill("newpassword123");

			await page
				.getByRole("button", { name: "Passwort aktualisieren" })
				.click();

			// Verify error message
			await expect(page.getByText("Das Passwort ist falsch.")).toBeVisible();

			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill("someOtherPassword");

			// Verify error message resets after changing current password field
			await expect(
				page.getByText("Das Passwort ist falsch."),
			).not.toBeVisible();
		},
	);

	testWithRegisteredUser(
		"Password change form UI states",
		async ({ page, account }) => {
			// Login and navigate to profile
			await page.goto("/login/");
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page
				.getByRole("textbox", { name: "Passwort" })
				.fill(account.password);
			await page.getByRole("button", { name: "Anmelden" }).click();
			await expect(page).toHaveURL("/");

			await openProfile(page);

			// Test 1: Submit button disabled when fields are empty
			await expect(
				page.getByRole("button", { name: "Passwort aktualisieren" }),
			).toBeDisabled();

			// Test 2: Submit button enabled when all fields are valid
			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill(account.password);
			await page.locator("#password").fill("validNewPassword");
			await page.locator("#repeatPassword").fill("validNewPassword");

			await expect(
				page.getByRole("button", { name: "Passwort aktualisieren" }),
			).toBeEnabled();

			// Test 3: Errors clear when user starts typing
			// First create an error
			await page.locator("#repeatPassword").fill("differentPassword");

			await expect(
				page.getByText("Die Passwörter stimmen nicht überein."),
			).toBeVisible();

			// Start typing to clear error
			await page.locator("#repeatPassword").clear();
			await page.locator("#repeatPassword").fill("validNewPassword");

			// Error should be gone
			await expect(
				page.getByText("Die Passwörter stimmen nicht überein."),
			).not.toBeVisible();

			// Test 4: Minimum password length validation
			await page.locator("#password").clear();
			await page.locator("#password").fill("12345"); // Too short

			// Tab out to trigger validation
			await page.keyboard.press("Tab");

			// Submit button should be disabled due to validation
			await expect(
				page.getByRole("button", { name: "Passwort aktualisieren" }),
			).toBeDisabled();
		},
	);

	testWithRegisteredUser(
		"Form resets after successful password change",
		async ({ page, account }) => {
			const newPassword = "anotherNewPass123";

			// Login and navigate to profile
			await page.goto("/login/");
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page
				.getByRole("textbox", { name: "Passwort" })
				.fill(account.password);
			await page.getByRole("button", { name: "Anmelden" }).click();
			await expect(page).toHaveURL("/");

			await openProfile(page);

			// Fill and submit form
			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill(account.password);
			await page.locator("#password").fill(newPassword);
			await page.locator("#repeatPassword").fill(newPassword);

			await page
				.getByRole("button", { name: "Passwort aktualisieren" })
				.click();

			// Wait for success toast
			await expect(page.getByText("Passwort wurde aktualisiert")).toBeVisible();

			// Verify form fields are cleared
			await expect(
				page.getByRole("textbox", { name: "Aktuelles Passwort" }),
			).toHaveValue("");
			await expect(page.locator("#password")).toHaveValue("");
			await expect(page.locator("#repeatPassword")).toHaveValue("");

			// Verify submit button is disabled again
			await expect(
				page.getByRole("button", { name: "Passwort aktualisieren" }),
			).toBeDisabled();

			// Cleanup: change password back
			await page
				.getByRole("textbox", { name: "Aktuelles Passwort" })
				.fill(newPassword);
			await page.locator("#password").fill(account.password);
			await page.locator("#repeatPassword").fill(account.password);

			await page
				.getByRole("button", { name: "Passwort aktualisieren" })
				.click();

			await expect(page.getByText("Passwort wurde aktualisiert")).toBeVisible();
		},
	);
});
