import { config } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * Vitest defines NODE_ENV as "test" by default, which would
 * enable sentry when running tests locally during development.
 * We want to have a single source of truth, which is the .env file,
 * therefore we use the override flag here.
 */
config({ override: true });

export default defineConfig({
	test: {
		globalSetup: ["./src/integration/setup.ts"],
		fileParallelism: false,
	},
});
