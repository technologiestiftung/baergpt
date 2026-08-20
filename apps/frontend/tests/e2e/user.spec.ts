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
		"should allow user to update personal prompt",
		async ({ page }) => {
			const waitForProfile = page.waitForResponse(
				(res) =>
					res.url().includes("/rest/v1/profiles") &&
					res.request().method() === "GET" &&
					res.ok(),
			);
			await page.goto("/profile/");

			await waitForProfile;

			const newPrompt = "This is a new personal prompt for testing.";
			const promptInput = page.locator("#personalPrompt");

			await expect(promptInput).toBeVisible();

			await promptInput.fill(newPrompt);
			await expect(promptInput).toHaveValue(newPrompt);

			const submitButton = page
				.locator("form")
				.filter({ has: promptInput })
				.getByRole("button", { name: Content["profile.submitButton"] });

			await expect(submitButton).toBeEnabled();

			let updateRequestDetails: { personal_system_prompt?: string } | null =
				null;
			await page.route("**/rest/v1/profiles*", async (route) => {
				if (route.request().method() === "PATCH") {
					updateRequestDetails = route.request().postDataJSON();
					await route.fulfill({
						status: 200,
						contentType: "application/json",
						body: JSON.stringify([{ personal_system_prompt: newPrompt }]),
					});
				} else {
					await route.fallback();
				}
			});

			await Promise.all([
				page.waitForResponse(
					(res) =>
						res.url().includes("/rest/v1/profiles") &&
						res.request().method() === "PATCH",
				),
				submitButton.click(),
			]);

			expect(updateRequestDetails).toEqual(
				expect.objectContaining({
					personal_system_prompt: newPrompt,
				}),
			);

			await expect(
				page.getByText(
					Content["profile.chatSettings.personalPromptUpdateSuccess"],
				),
			).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"should respect max character limit for personal prompt",
		async ({ page }) => {
			const waitForProfile = page.waitForResponse(
				(res) =>
					res.url().includes("/rest/v1/profiles") &&
					res.request().method() === "GET" &&
					res.ok(),
			);

			await page.goto("/profile/");

			await waitForProfile;

			const promptInput = page.locator("#personalPrompt");
			await expect(promptInput).toBeVisible();

			await expect(promptInput).toHaveAttribute("maxLength", "500");

			const longText = "a".repeat(505);
			await promptInput.fill(longText);

			const inputValue = await promptInput.inputValue();
			expect(inputValue.length).toBe(500);

			const counterText = page.locator("#personalPromptCounter");
			await expect(counterText).toContainText("500 / 500");
		},
	);

	testWithLoggedInUser(
		"should stay on profile page when account deletion fails",
		async ({ page, account }) => {
			await page.goto("/profile/");
			await page.getByTestId("delete-account-button").click();

			const dialog = page.locator("#delete-account-dialog");
			await expect(dialog).toBeVisible();

			await page.fill("#currentPasswordValidation", account.password);

			// Set up route interceptor just before submitting — delete_user is
			// only called on confirm, so setting it up here avoids interfering
			// with session refresh requests made during page load.
			await page.route("**/rest/v1/rpc/delete_user", (route) =>
				route.fulfill({
					status: 500,
					contentType: "application/json",
					body: JSON.stringify({
						code: "57014",
						message: "canceling statement due to statement timeout",
						details: null,
						hint: null,
					}),
				}),
			);

			// Wait for the delete_user RPC to complete before asserting URL,
			// otherwise the assertion races with the async navigation.
			await Promise.all([
				page.waitForResponse("**/rest/v1/rpc/delete_user"),
				page.getByTestId("confirm-delete-account-button").click(),
			]);

			await expect(page).toHaveURL("/profile/");
		},
	);

	testWithLoggedInUser(
		"should allow user to delete account",
		async ({ page, account }) => {
			await page.goto("/profile/");

			// Click the delete account button to open dialog
			await page.getByTestId("delete-account-button").click();

			// Dialog should be visible
			const dialog = page.locator("#delete-account-dialog");
			await expect(dialog).toBeVisible();

			// click the password input field in the dialog
			await page.click("#currentPasswordValidation");
			// Fill in the password input field
			await page.fill("#currentPasswordValidation", account.password);

			// Click delete button in dialog to confirm
			await page.getByTestId("confirm-delete-account-button").click();

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
