import { testWithDocuments } from "./test-with-documents.ts";

// Create a test fixture that will automatically skip on mobile
export const testDesktopOnly = testWithDocuments.extend({
	page: async ({ page, isMobile }, use) => {
		/**
		 * This happens before each test that uses this fixture.
		 */
		// Skip this test on mobile devices
		testWithDocuments.skip(
			isMobile === true,
			"Skipping desktop tests on mobile",
		);

		/**
		 * This runs the test that uses this fixture (and injects the page).
		 */
		await use(page);
	},
});
