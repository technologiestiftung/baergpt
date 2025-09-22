import globals from "globals";
import technologiestiftung from "@technologiestiftung/eslint-config";

export default [
	...technologiestiftung,
	{
		files: ["**/*.{js,mjs,cjs,ts}"],
		plugins: {
			// add plugins here
		},
		languageOptions: {
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.node,
			},
		},
		rules: {
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-unused-expressions": [
				"error",
				{
					allowShortCircuit: false,
				},
			],
		},
	},
];
