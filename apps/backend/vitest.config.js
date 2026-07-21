import { createRequire } from "node:module";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * Vitest defines NODE_ENV as "test" by default, which would
 * enable sentry when running tests locally during development.
 * We want to have a single source of truth, which is the .env file,
 * therefore we use the override flag here.
 */
config({ override: true });
process.env.NODE_ENV = "test";

// mistral-tokenizer-ts ESM build uses __dirname (undefined in ESM).
// Alias to CJS build so it loads correctly in Vitest.
const mistralCjs = createRequire(import.meta.url).resolve("mistral-tokenizer-ts");

export default defineConfig({
	resolve: {
		alias: {
			"mistral-tokenizer-ts": mistralCjs,
		},
	},
	test: {
		setupFiles: ["./vitest.setup.ts"],
		globalSetup: ["./src/integration/setup.ts"],
		fileParallelism: false,
	},
});
