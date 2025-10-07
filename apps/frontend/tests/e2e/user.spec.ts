import { defaultUserFirstName, defaultUserLastName } from "../constants";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user";
import { expect } from "@playwright/test";
import Content from "../../src/content";

testWithLoggedInUser.describe("User Profile", () => {
	testWithLoggedInUser.describe("greeting messages", () => {
		const testGreeting = (hour: number, expectedContent: string) =>
			testWithLoggedInUser(
				`should show ${expectedContent} greeting at ${hour}:00`,
				async ({ page }) => {
					// Set up the page to use our mocked date
					await page.addInitScript((givenHour: number) => {
						const mockedDate = new Date();
						mockedDate.setHours(givenHour, 0, 0, 0);
						Date.now = () => mockedDate.getTime();
						Date.prototype.getHours = () => givenHour;
					}, hour);

					await page.goto("/profile/");
					const heading = page.locator("h1");
					await expect(heading).toContainText(expectedContent);
					await expect(heading).toContainText(defaultUserFirstName);
					await expect(heading).toContainText(defaultUserLastName);
				},
			);

		testGreeting(7, Content["profile.h1.morning"]);
		testGreeting(12, Content["profile.h1.afternoon"]);
		testGreeting(20, Content["profile.h1.evening"]);
		testGreeting(2, Content["profile.h1.default"]);
	});

	testWithLoggedInUser(
		"should allow user to update profile information",
		async ({ page }) => {
			await page.goto("/profile/");

			// Check default empty state for dropdowns
			await expect(page.locator("#personalTitle")).toHaveValue("");
			await expect(page.locator("#academicTitle")).toHaveValue("");

			// Select values from dropdowns
			await page.selectOption("#personalTitle", "Frau");
			await page.selectOption("#academicTitle", "Dr.");

			// Check default values for text inputs
			await expect(page.locator("#firstName")).toHaveValue(
				defaultUserFirstName,
			);
			await expect(page.locator("#lastName")).toHaveValue(defaultUserLastName);

			const UpdatedFirstName = "jane";
			const UpdatedLastName = "smith";

			// Fill in all form fields with new data
			await page.fill("#firstName", UpdatedFirstName);
			await page.fill("#lastName", UpdatedLastName);

			// Submit form
			await page.click("button[type='submit']");

			// Check that all values were updated
			await expect(page.locator("#personalTitle")).toHaveValue("Frau");
			await expect(page.locator("#academicTitle")).toHaveValue("Dr.");
			await expect(page.locator("#firstName")).toHaveValue(UpdatedFirstName);
			await expect(page.locator("#lastName")).toHaveValue(UpdatedLastName);
		},
	);

	testWithLoggedInUser(
		"should allow user to change chat settings to informal/formal",
		async ({ page }) => {
			await page.goto("/profile/");

			// Find the checkbox input for initial state verification
			// the input has the ID change-salutation-checkbox
			const checkboxInput = page.locator("#change-salutation-checkbox");

			// initially, the checkbox should not be checked (formal)
			await expect(checkboxInput).not.toBeChecked();

			// Click on the toggle (since the actual checkbox is sr-only)
			const toggle = page.locator("#change-salutation-toggle");
			await toggle.click();

			await expect(checkboxInput).toBeChecked();

			// After toggling, the salutation should change to informal
			await page.goto("/");

			// Salutation in main page should now be informal
			await expect(
				page.getByRole("heading", {
					name: `Willkommen bei BärGPT, ${defaultUserFirstName}`,
				}),
			).toBeVisible();

			// go back to profile page to toggle back to formal
			await page.goto("/profile/");

			// add timeout to ensure toggle state is loaded
			await page.waitForTimeout(1000);

			// toggle back to formal
			await toggle.click();

			await expect(checkboxInput).not.toBeChecked();

			// After toggling, the salutation should change back to formal
			await page.goto("/");

			// Salutation in main page should now be formal
			await expect(
				page.getByRole("heading", {
					name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
				}),
			).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"should allow user to delete account",
		async ({ page, account }) => {
			await page.goto("/profile/");

			// Click the delete account button to open dialog
			await page.click("#delete-account-button");

			// Dialog should be visible
			const dialog = page.locator("#delete-account-dialog");
			await expect(dialog).toBeVisible();

			// click the password input field in the dialog
			await page.click("#currentPasswordValidation");
			// Fill in the password input field
			await page.fill("#currentPasswordValidation", account.password);

			// Click delete button in dialog to confirm
			await page.click("#confirm-delete-account-button");

			// Should be redirected to account deleted page after account deletion
			await page.waitForURL("/account-deleted/");
			await expect(page).toHaveURL("/account-deleted/");

			const accountDeletedHeading = page.locator("h1");
			await expect(accountDeletedHeading).toContainText(
				"Ihr Account wurde gelöscht.",
			);
		},
	);
});
