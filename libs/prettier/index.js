import technologiestiftung from "@technologiestiftung/prettier-config";

export default {
	...technologiestiftung,
	plugins: ["prettier-plugin-sql"],
	/**
	 * The following settings are used for the SQL plugin.
	 */
	language: "postgresql",
	keywordCase: "upper",
	dataTypeCase: "upper",
	functionCase: "upper",
	expressionWidth: 100,
	overrides: [
		// use default of sql plugin: https://github.com/sql-formatter-org/sql-formatter/blob/master/docs/useTabs.md
		{
			files: "**/*.sql",
			options: {
				useTabs: false, // use spaces instead of tabs for SQL, as it would otherwise would get overwritten by our default prettier config for TS
				tabWidth: 4,
			},
		},
	],
};
