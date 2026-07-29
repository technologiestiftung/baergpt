import technologiestiftung from "@technologiestiftung/oxlint-config";

export default {
	$schema: "./node_modules/oxlint/configuration_schema.json",
	...technologiestiftung,
	plugins: [...technologiestiftung.plugins, "react"],
	rules: {
		...technologiestiftung.rules,
		// React plugin rules carried over from the old @repo/eslint config.
		"react/react-in-jsx-scope": "off",
		"react/self-closing-comp": "error",
		// The old ESLint setup did not enable react-hooks/exhaustive-deps;
		// keeping it off avoids new errors in existing code.
		"react-hooks/exhaustive-deps": "off",
	},
	overrides: [
		{
			files: ["**/tests/fixtures/**"],
			rules: {
				// Playwright fixtures commonly destructure an empty object
				// when no dependencies are used.
				"no-empty-pattern": "off",
			},
		},
	],
};
