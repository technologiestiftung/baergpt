export function getLanguageLabel(className: string | undefined): string | null {
	const classTokens = className?.split(/\s+/).filter(Boolean) ?? [];
	// rehype-highlight only ever emits a `language-xxx` class,
	// carrying through whatever language tag the fence itself used (e.g. ```js).
	const languageToken = classTokens
		.map((token) => /^language-(.+)$/i.exec(token)?.[1])
		.find((token): token is string => Boolean(token));

	return languageToken ?? null;
}
