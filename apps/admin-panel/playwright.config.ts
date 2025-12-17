import { dirname, resolve } from "path";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { defineConfig, devices } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, ".env"), override: true });

const { verifyConfig } = await import("./tests/config.ts");

verifyConfig();

const port = parseInt(process.env.VITE_PORT ?? "5174");
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
	webServer: [
		{
			/**
			 * You might wonder why we don't run a build step here when
			 * we're in the CI before starting the preview server.
			 * We're running the build step beforehand in the workflow
			 * as an own step so we can cache it between jobs.
			 */
			command: `${process.env.CI ? "npm run preview" : "npm run dev"} -- --port ${port}`,
			url: `http://localhost:${port}`,
			reuseExistingServer: !process.env.CI,
		},
		{
			// Wait for backend to be ready (started by Turborepo via "with" field).
			// Playwright treats an early-exiting process as a failure, so keep this process alive
			// while it waits for `url` to become reachable.
			command: `node -e "setInterval(() => {}, 1000)"`,
			url: "http://localhost:3000",
			timeout: 30_000,
			reuseExistingServer: true,
		},
	],
});
