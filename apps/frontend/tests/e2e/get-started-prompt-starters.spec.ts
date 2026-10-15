import { expect } from "@playwright/test";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";

const isParlaAllowed =
	process.env.VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED === "true";
const isWebSearchAllowed =
	process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED === "true";

testWithLoggedInUser.describe("Welcome screen prompt starters", () => {
	testWithLoggedInUser(
		"replaces the previously selected tool instead of stacking",
		async ({ page }) => {
			testWithLoggedInUser.skip(
				!isParlaAllowed || !isWebSearchAllowed,
				"needs both Parla and web search feature flags",
			);

			await page.goto("/");

			const parlaPill = page.getByRole("button", {
				name: "Parla Berlin entfernen",
			});
			const webSearchPill = page.getByRole("button", {
				name: "Websuche entfernen",
			});

			await page.getByRole("button", { name: "Parla durchsuchen" }).click();
			await expect(parlaPill).toBeVisible();

			await page.getByRole("button", { name: "Im Web recherchieren" }).click();
			await expect(webSearchPill).toBeVisible();
			await expect(parlaPill).toBeHidden();

			await page
				.getByRole("button", { name: "Schreiben oder Bearbeiten" })
				.click();
			await expect(webSearchPill).toBeHidden();
			await expect(parlaPill).toBeHidden();

			// The writing prompts replaced the starters, so the third pick landed.
			await expect(
				page.getByRole("button", { name: "Freundlicher formulieren" }),
			).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"keeps a starter selected when it is picked twice",
		async ({ page }) => {
			testWithLoggedInUser.skip(
				!isWebSearchAllowed,
				"needs the web search feature flag",
			);

			await page.goto("/");

			const webSearchStarter = page.getByRole("button", {
				name: "Im Web recherchieren",
			});
			const webSearchPill = page.getByRole("button", {
				name: "Websuche entfernen",
			});

			await webSearchStarter.click();
			await expect(webSearchPill).toBeVisible();

			await webSearchStarter.click();
			await expect(webSearchPill).toBeVisible();
		},
	);
});
