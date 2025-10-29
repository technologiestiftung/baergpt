import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { supabaseAdminClient } from "../supabase.ts";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";

const defaultUserEmail = "john.doe-a11y@berlin.de";
const defaultUserPassword = "123456";
const defaultUserFirstName = "John";
const defaultUserLastName = "Doe";

test.describe("Accessibility - Auth Flow", () => {
	test("Invite completion form and main page after login should be accessible", async ({
		browserName,
		page,
	}) => {
		// Skip Firefox due to CI environment issues with headless mode
		test.skip(
			browserName === "firefox",
			"Skipping Firefox due to CI headless mode issues",
		);

		// 1. Invite user via mail
		const { error: inviteLinkError } =
			await supabaseAdminClient.auth.admin.inviteUserByEmail(defaultUserEmail, {
				data: {
					first_name: defaultUserFirstName,
					last_name: defaultUserLastName,
				},
			});

		expect(inviteLinkError).toBeNull();

		// 2. Open the invite link in mail inbucket
		await page.goto("http://localhost:54324/"); // Inbucket URL
		await page
			.getByRole("link", { name: `Admin To: ${defaultUserEmail}` })
			.first()
			.click();

		const popupEvent = page.waitForEvent("popup");
		await page
			.locator("#preview-html")
			.contentFrame()
			.getByRole("link", { name: "Jetzt registrieren" })
			.click();
		const page1 = await popupEvent;

		// 3. Wait for /account-activated/ to be fully loaded
		await page1.waitForLoadState("networkidle");

		await expect(
			page1.getByRole("heading", { name: "Willkommen bei BärGPT" }),
		).toBeVisible();

		// 4. Run accessibility scan on the invite completion form
		const registerA11yResults = await new AxeBuilder({ page: page1 }).analyze();
		expect(registerA11yResults.violations).toEqual([]);

		// 5. Fill invite completion form
		await page1
			.getByRole("textbox", { name: "Passwort Ein Fragezeichen-" })
			.fill(defaultUserPassword);
		await page1
			.getByRole("textbox", { name: "Passwort wiederholen Password" })
			.fill(defaultUserPassword);
		await page1.getByTestId("label-has-accepted-privacy-checkbox").click();
		await page1
			.getByRole("button", { name: "Registrieren Ein weißer Pfeil" })
			.click();

		// 6. Wait for main page after login
		await expect(
			page1.getByRole("heading", { name: "Willkommen bei BärGPT, John Doe" }),
		).toBeVisible();

		// 7. Run accessibility scan on the main page
		const mainPageA11yResults = await new AxeBuilder({ page: page1 }).analyze();
		expect(mainPageA11yResults.violations).toEqual([]);

		// logout user
		await page1.getByRole("button", { name: "Profil" }).click();
		await page1.getByRole("button", { name: "Ausloggen" }).click();
	});

	// Cleanup: Delete the user after each test
	test.afterAll("Cleanup user", async () => {
		const { data, error } = await supabaseAdminClient.auth.admin.listUsers();

		if (error) {
			console.error("Error listing users:", error);
			return;
		}

		// Find the user by email
		const user = data.users.find(({ email }) => email === defaultUserEmail);
		if (!user) {
			return;
		}

		// Delete the user by ID only if found
		const { error: deleteError } =
			await supabaseAdminClient.auth.admin.deleteUser(user.id);
		if (deleteError) {
			console.error("Error deleting user:", deleteError);
		}
	});

	// test accessibility for profile page
	testWithLoggedInUser(
		"Profile page should be accessible",
		async ({ page }) => {
			await page.goto("/profile/");

			// Run accessibility scan on the profile page
			const a11yResults = await new AxeBuilder({ page }).analyze();
			expect(a11yResults.violations).toEqual([]);
		},
	);
});

test.describe("Accessibility - Public Pages", () => {
	// test accessibility for privacy policy page
	test("Privacy policy page should be accessible", async ({ page }) => {
		await page.goto("/privacy-policy/");

		// Wait for page to be fully loaded
		await page.waitForLoadState("networkidle");

		// Run accessibility scan on the privacy policy page
		const a11yResults = await new AxeBuilder({ page }).analyze();
		expect(a11yResults.violations).toEqual([]);
	});
});
