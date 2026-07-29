import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// mistral-tokenizer-ts ESM build uses __dirname (undefined in ESM).
// Alias to CJS build so it loads correctly in Vitest.
const mistralCjs = createRequire(import.meta.url).resolve(
	"mistral-tokenizer-ts",
);

export default defineConfig({
	resolve: {
		alias: {
			"mistral-tokenizer-ts": mistralCjs,
		},
	},
	test: {
		globalSetup: ["./src/integration/setup.ts"],
		fileParallelism: false,
	},
});
