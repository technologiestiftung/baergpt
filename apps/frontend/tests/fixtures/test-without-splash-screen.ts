import { MOCK_SPLASH_RELEASE_SHA, VERSION_STORAGE_KEY } from "../constants.ts";
import { test as baseTest } from "@playwright/test";

export const testWithoutSplashScreen = baseTest.extend({
	page: async ({ page }, use) => {
		await page.context().route(
			(url) =>
				url.hostname === "api.github.com" &&
				/^\/repos\/[^/]+\/[^/]+\/commits\//.test(url.pathname),
			(route) =>
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ sha: MOCK_SPLASH_RELEASE_SHA }),
				}),
		);

		await page.addInitScript(
			({ storageKey, sha }) => {
				localStorage.setItem(storageKey, sha);
			},
			{ storageKey: VERSION_STORAGE_KEY, sha: MOCK_SPLASH_RELEASE_SHA },
		);

		await page.goto("/");
		await use(page);
	},
});
