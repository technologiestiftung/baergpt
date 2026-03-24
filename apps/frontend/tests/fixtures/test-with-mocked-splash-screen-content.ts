import { testWithLoggedInUser } from "./test-with-logged-in-user.ts";
import { MOCK_SPLASH_RELEASE_SHA, VERSION_STORAGE_KEY } from "../constants.ts";

export const testWithMockedSplashScreenContent = testWithLoggedInUser.extend({
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
		await page.route("**/release-update.md", (route) => {
			return route.fulfill({
				status: 200,
				contentType: "text/markdown",
				body: "Mock Content for Splash Screen",
			});
		});
		await page.evaluate((key) => {
			localStorage.removeItem(key);
		}, VERSION_STORAGE_KEY);

		/**
		 * This runs the test that uses this fixture.
		 */
		await use(page);
	},
});
