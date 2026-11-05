import { MOCK_SPLASH_RELEASE_SHA, VERSION_STORAGE_KEY } from "../constants.ts";
import { test as baseTest, type BrowserContext } from "@playwright/test";

/**
 * Answers the splash screen's GitHub commit request with a fixed sha, so tests
 * never reach the real GitHub API.
 */
export async function mockSplashCommitRoute(context: BrowserContext) {
	await context.route(
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
}

export const testWithoutSplashScreen = baseTest.extend({
	page: async ({ page }, use) => {
		await mockSplashCommitRoute(page.context());

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
