import { VERSION_STORAGE_KEY } from "../constants.ts";
import { test as baseTest } from "@playwright/test";

declare global {
	interface Window {
		__TEST_BUILD_TIMESTAMP__: string;
	}
}

export const testWithoutSplashScreen = baseTest.extend({
	page: async ({ page }, use) => {
		/**
		 * This happens before each test that uses this fixture.
		 */
		await page.goto("/"); // Navigate to the app to initialize localStorage and other browser contexts;

		await page.evaluate((storageKey) => {
			localStorage.setItem(storageKey, window.__TEST_BUILD_TIMESTAMP__);
		}, VERSION_STORAGE_KEY);

		/**
		 * This runs the test that uses this fixture (and injects the version).
		 */
		await use(page);
	},
});
