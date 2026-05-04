import { testWithLoggedInUser } from "./test-with-logged-in-user.ts";
import {
	mockLlmCompletion,
	type MockLlmCompletionOptions,
} from "./mock-llm.ts";

type MockedLlmFixtures = {
	mockLlm: (options?: MockLlmCompletionOptions) => Promise<void>;
	/** Registers default LLM stub and tears down routes after each test */
	_autoMockLlm: undefined;
};

export const testWithMockedLlm = testWithLoggedInUser.extend<MockedLlmFixtures>(
	{
		_autoMockLlm: [
			async ({ page }, use) => {
				await mockLlmCompletion(page, {});
				await use(undefined);
				await page.unroute("**/llm/just-chatting");
			},
			{ auto: true },
		],
		mockLlm: async ({ page }, use) => {
			await use(async (options?: MockLlmCompletionOptions) => {
				await mockLlmCompletion(page, options ?? {});
			});
		},
	},
);
