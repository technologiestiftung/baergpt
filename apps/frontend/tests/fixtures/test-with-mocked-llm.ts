import { testWithLoggedInUser } from "./test-with-logged-in-user.ts";
import { mockLlmCompletion } from "./mock-llm.ts";

export const testWithMockedLlm = testWithLoggedInUser.extend({
	page: async ({ page }, use) => {
		/**
		 * This happens before each test that uses this fixture.
		 */
		await mockLlmCompletion(page, {});

		/**
		 * This runs the test that uses this fixture (and injects the page).
		 */
		await use(page);

		await page.unroute("**/llm/just-chatting");
	},
});
