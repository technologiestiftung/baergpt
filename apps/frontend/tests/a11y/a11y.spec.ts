import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { testWithoutSplashScreen } from "../fixtures/test-without-splash-screen.ts";

testWithoutSplashScreen.describe("Accessibility - Auth Flow", () => {
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
	// test accessibility for register page
	test("Register page should be accessible", async ({ page }) => {
		await page.goto("/register/");

		// Wait for page to be fully loaded
		await page.waitForLoadState("networkidle");

		// Run accessibility scan on the privacy policy page
		const a11yResults = await new AxeBuilder({ page }).analyze();
		expect(a11yResults.violations).toEqual([]);
	});

	// test accessibility for privacy policy page
	test("Privacy policy page should be accessible", async ({ page }) => {
		await page.goto("/privacy-policy/");

		// Wait for page to be fully loaded
		await page.waitForLoadState("networkidle");

		// Run accessibility scan on the privacy policy page
		const a11yResults = await new AxeBuilder({ page }).analyze();
		expect(a11yResults.violations).toEqual([]);
	});

	// test accessibility for terms of use page
	test("Terms of use page should be accessible", async ({ page }) => {
		await page.goto("/terms-of-use/");

		// Wait for page to be fully loaded
		await page.waitForLoadState("networkidle");

		// Run accessibility scan on the terms of use page
		const a11yResults = await new AxeBuilder({ page }).analyze();
		expect(a11yResults.violations).toEqual([]);
	});
});
