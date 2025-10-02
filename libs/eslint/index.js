import globals from "globals";
import technologiestiftung from "@technologiestiftung/eslint-config";
import react from "eslint-plugin-react";
import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";

const gitignorePath = fileURLToPath(
	new URL("../../.gitignore", import.meta.url),
);

export default [
	includeIgnoreFile(gitignorePath),
	...technologiestiftung,
	{
		files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
		plugins: {
			react,
		},
		languageOptions: {
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			"react/react-in-jsx-scope": "off",
			"react/self-closing-comp": "error",
			"@typescript-eslint/no-unused-expressions": [
				"error",
				{
					allowShortCircuit: true,
					allowTernary: true,
					allowTaggedTemplates: true,
				},
			],

			/**
			 * When the rule no-empty-pattern is 'on'
			 * it conflicts with some playwright fixtures
			 */
			"no-empty-pattern": "off",
		},
	},
];
