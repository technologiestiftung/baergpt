import { testWithLoggedInUser } from "./test-with-logged-in-user.ts";
import { VERSION_STORAGE_KEY } from "../constants.ts";

export const testWithMockedSplashScreenContent = testWithLoggedInUser.extend({
	page: async ({ page }, use) => {
		/**
		 * This happens before each test that uses this fixture.
		 */
		await page.route("**/release-update.md", (route) => {
			return route.fulfill({
				status: 200,
				contentType: "text/markdown",
				body: "Mock Content for Splash Screen",
			});
		});
		/**
		 * Runs after the splash-bypass init script on each navigation so
		 * `last-seen-version` is cleared and the splash flow can run in these specs.
		 */
		await page.addInitScript((key) => {
			window.localStorage.removeItem(key);
		}, VERSION_STORAGE_KEY);

		/**
		 * This runs the test that uses this fixture.
		 */
		await use(page);
	},
});
