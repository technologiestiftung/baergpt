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
	identifierCase: "lower",
};
