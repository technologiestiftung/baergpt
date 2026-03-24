import { expect } from "@playwright/test";
import { testWithMockedSplashScreenContent } from "../fixtures/test-with-mocked-splash-screen-content.ts";
import { MOCK_SPLASH_RELEASE_SHA, VERSION_STORAGE_KEY } from "../constants.ts";

testWithMockedSplashScreenContent.describe("Splash Modal", () => {
	testWithMockedSplashScreenContent(
		"should display splash modal on first visit",
		async ({ page }) => {
			// Navigate to the main page
			await page.goto("/");

			// Wait for modal to be visible
			const modal = page.locator("#splash-modal");
			await expect(modal).toBeVisible();

			// Check modal title
			await expect(
				page.getByRole("heading", { name: "Was ist neu?" }),
			).toBeVisible();

			// Check modal description
			await expect(
				page.getByText("Die wichtigsten Neuerungen im Überblick"),
			).toBeVisible();
		},
	);

	testWithMockedSplashScreenContent(
		"should close splash modal when clicking the close button",
		async ({ page }) => {
			// Navigate to the main page
			await page.goto("/");

			// Wait for modal to be visible
			const modal = page.locator("#splash-modal");
			await expect(modal).toBeVisible();

			// Click the close button
			await page.getByTestId("close-splash-modal-button").click();

			// Modal should be hidden
			await expect(modal).toBeHidden();

			// Wait for localStorage to be updated
			await page.waitForFunction(
				(key) => localStorage.getItem(key) !== null,
				VERSION_STORAGE_KEY,
			);

			// Verify that the release commit SHA was stored in localStorage
			const lastSeenSha = await page.evaluate((key) => {
				return localStorage.getItem(key);
			}, VERSION_STORAGE_KEY);

			expect(lastSeenSha).toBe(MOCK_SPLASH_RELEASE_SHA);
		},
	);

	testWithMockedSplashScreenContent(
		"should close splash modal when pressing ESC key",
		async ({ page }) => {
			// Navigate to the main page
			await page.goto("/");

			// Wait for modal to be visible
			const modal = page.locator("#splash-modal");
			await expect(modal).toBeVisible();

			// Press ESC key
			await page.keyboard.press("Escape");

			// Modal should be hidden
			await expect(modal).toBeHidden();

			// Wait for localStorage to be updated
			await page.waitForFunction(
				(key) => localStorage.getItem(key) !== null,
				VERSION_STORAGE_KEY,
			);

			// Verify that the release commit SHA was stored in localStorage
			const lastSeenSha = await page.evaluate((key) => {
				return localStorage.getItem(key);
			}, VERSION_STORAGE_KEY);

			expect(lastSeenSha).toBe(MOCK_SPLASH_RELEASE_SHA);
		},
	);

	testWithMockedSplashScreenContent(
		"should not display splash modal on subsequent visits after closing",
		async ({ page }) => {
			// Navigate to the main page
			await page.goto("/");

			// Clear localStorage to simulate first visit
			await page.evaluate(() => {
				window.localStorage.clear();
			});

			// Reload to trigger the splash modal check
			await page.reload();

			// Wait for modal to be visible
			const modal = page.locator("#splash-modal");
			await expect(modal).toBeVisible();

			// Close the modal with the close button
			await page.getByTestId("close-splash-modal-button").click();

			// Modal should be hidden
			await expect(modal).toBeHidden();

			// Wait for localStorage to be updated
			await page.waitForFunction(
				(key) => localStorage.getItem(key) !== null,
				VERSION_STORAGE_KEY,
			);

			// Refresh the page
			await page.reload();

			// Modal should not appear again
			await expect(modal).toBeHidden();
		},
	);

	testWithMockedSplashScreenContent(
		"should display splash modal if stored release sha differs from current",
		async ({ page }) => {
			// Set a different timestamp value than what's current
			await page.addInitScript(
				({ key, value }) => {
					window.localStorage.setItem(key, value);
				},
				{ key: VERSION_STORAGE_KEY, value: "old-release-commit-sha" },
			);

			// Navigate to the main page
			await page.goto("/");

			// Modal SHOULD be visible because stored SHA does not match the mocked current SHA
			const modal = page.locator("#splash-modal");
			await expect(modal).toBeVisible();
		},
	);

	testWithMockedSplashScreenContent(
		"should display modal content from markdown",
		async ({ page }) => {
			// Navigate to the main page
			await page.goto("/");

			// Reload to trigger the splash modal check
			await page.reload();

			// Wait for modal to be visible
			const modal = page.locator("#splash-modal");
			await expect(modal).toBeVisible();

			// Check that the markdown container exists
			const markdownContainer = page.getByTestId(
				"splash-modal-markdown-container",
			);
			await expect(markdownContainer).not.toBeEmpty();
		},
	);
});
