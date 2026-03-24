import { MOCK_SPLASH_RELEASE_SHA, VERSION_STORAGE_KEY } from "../constants.ts";
import { test as baseTest } from "@playwright/test";

export const testWithoutSplashScreen = baseTest.extend({
	page: async ({ page }, use) => {
		/**
		 * This happens before each test that uses this fixture.
		 */
		await page.route("**/api.github.com/repos/**/commits/**", (route) => {
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ sha: MOCK_SPLASH_RELEASE_SHA }),
			});
		});
		await page.addInitScript(
			({ key, sha }) => {
				localStorage.setItem(key, sha);
			},
			{ key: VERSION_STORAGE_KEY, sha: MOCK_SPLASH_RELEASE_SHA },
		);
		await page.goto("/");

		/**
		 * This runs the test that uses this fixture (and injects the version).
		 */
		await use(page);
	},
});
