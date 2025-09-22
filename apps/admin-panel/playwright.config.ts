import { dirname, resolve } from "path";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { defineConfig, devices } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.CI) {
	config({ path: resolve(__dirname, ".env") });
}

const { verifyConfig } = await import("./tests/config.ts");

verifyConfig();

const port = parseInt(process.env.VITE_PORT ?? "5173");
/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests",
	timeout: process.env.CI ? 120_000 : 45_000,
	expect: {
		timeout: 30_000,
	},
	maxFailures: 1,
	/* Run tests in files in parallel */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* No retries */
	retries: 0,
	/* Opt out of parallel tests. */
	workers: 1,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		["list"],
		["html", { open: process.env.CI ? "never" : "on-failure" }],
	],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: `http://localhost:${port}`,

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "retain-on-failure",

		/* Navigation timeout */
		navigationTimeout: 30_000,

		/* Action timeout */
		actionTimeout: 30_000,
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				isMobile: false,
				permissions: ["clipboard-read", "clipboard-write"],
			},
		},

		{
			name: "firefox",
			use: {
				...devices["Desktop Firefox"],
				isMobile: false,
			},
		},

		{
			name: "webkit",
			use: {
				...devices["Desktop Safari"],
				isMobile: false,
			},
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: `npm run build && npm run preview -- --port ${port}`,
		url: `http://localhost:${port}`,
		reuseExistingServer: !process.env.CI,
	},
});
