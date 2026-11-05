import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { testWithoutSplashScreen } from "../fixtures/test-without-splash-screen.ts";

testWithoutSplashScreen.describe("Accessibility - Chat form", () => {
	testWithLoggedInUser(
		"Open model dropdown should be accessible",
		async ({ page }) => {
			await page.goto("/");

			await page.getByRole("button", { name: "Schnell", exact: false }).click();

			await expect(
				page.getByRole("switch", { name: "Länger nachdenken auswählen" }),
			).toBeVisible();

			const a11yResults = await new AxeBuilder({ page }).analyze();
			expect(a11yResults.violations).toEqual([]);
		},
	);
});

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

testWithoutSplashScreen.describe("Accessibility - Public Pages", () => {
	// test accessibility for login page
	testWithoutSplashScreen(
		"Login page should be accessible",
		async ({ page }) => {
			await page.goto("/login/");

			// The page is static, so wait for it to render before scanning
			await expect(page.getByRole("main")).toBeVisible();

			// Run accessibility scan on the privacy policy page
			const a11yResults = await new AxeBuilder({ page }).analyze();
			expect(a11yResults.violations).toEqual([]);
		},
	);

	// test accessibility for privacy policy page
	testWithoutSplashScreen(
		"Privacy policy page should be accessible",
		async ({ page }) => {
			await page.goto("/privacy-policy/");

			// The page is static, so wait for it to render before scanning
			await expect(page.getByRole("main")).toBeVisible();

			// Run accessibility scan on the privacy policy page
			const a11yResults = await new AxeBuilder({ page }).analyze();
			expect(a11yResults.violations).toEqual([]);
		},
	);

	// test accessibility for terms of use page
	testWithoutSplashScreen(
		"Terms of use page should be accessible",
		async ({ page }) => {
			await page.goto("/terms-of-use/");

			// The page is static, so wait for it to render before scanning
			await expect(page.getByRole("main")).toBeVisible();

			// Run accessibility scan on the terms of use page
			const a11yResults = await new AxeBuilder({ page }).analyze();
			expect(a11yResults.violations).toEqual([]);
		},
	);
});
