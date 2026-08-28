import { tool } from "ai";
import { z } from "zod";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";

export type BraveWebSearchResult = {
	grounding: {
		generic: {
			url: string;
			title: string;
			snippets: string[] | Record<string, unknown>[];
		}[];
	};
	sources: {
		[url: string]: {
			title: string;
			age: string[] | null;
		};
	};
};

export type WebCitationSource = {
	url: string;
	title: string;
	snippet: string;
	age?: string[] | null;
};

export type StaanWebSearchResult = {
	search_id: string;
	query: {
		q: string;
		market: string;
		count: number;
		offset: number;
	};
	web: {
		results: {
			title: string;
			url: string;
			snippet: string;
			display_url: string;
			hostname: string;
			published_date: string;
			extra_snippets: {
				chunk: string;
				score: number;
			}[];
			full_content: {
				text: string;
				format: string;
				length: number;
			};
		}[];
	};
};

type WebSearchError = {
	type: string;
	error: {
		id: string;
		status: number;
		detail: string;
		meta: Record<string, unknown>;
		code: string;
	};
	time: number;
};

const EMPTY_BRAVE_RESULT: BraveWebSearchResult = {
	grounding: { generic: [] },
	sources: {},
};
const EMPTY_STAAN_RESULT: StaanWebSearchResult = {
	search_id: "",
	query: {
		q: "",
		market: "",
		count: 0,
		offset: 0,
	},
	web: {
		results: [],
	},
};
const REQUEST_TIMEOUT_MS = 30_000;

function isBraveWebSearchResult(
	output: unknown,
): output is BraveWebSearchResult {
	return (
		typeof output === "object" &&
		output !== null &&
		"grounding" in output &&
		"sources" in output
	);
}

function isStaanWebSearchResult(
	output: unknown,
): output is StaanWebSearchResult {
	return (
		typeof output === "object" &&
		output !== null &&
		"web" in output &&
		!("grounding" in output)
	);
}

function extractBraveWebSources(
	output: BraveWebSearchResult,
): WebCitationSource[] {
	const generic = output.grounding?.generic;
	const sources = output.sources;
	if (!generic?.length || !sources) {
		return [];
	}

	return generic
		.filter(
			(item) =>
				item.snippets.find((s): s is string => typeof s === "string") !==
				undefined,
		)
		.map((item) => ({
			url: item.url,
			title: item.title,
			snippet: item.snippets.find(
				(s): s is string => typeof s === "string",
			) as string,
			age: sources[item.url]?.age,
		}));
}

function extractStaanWebSources(
	output: StaanWebSearchResult,
): WebCitationSource[] {
	const results = output.web?.results;
	if (!results?.length) {
		return [];
	}

	return results
		.filter(
			(item) => typeof item.snippet === "string" && item.snippet.length > 0,
		)
		.map((item) => ({
			url: item.url,
			title: item.title,
			snippet: item.snippet,
			age: item.published_date ? [item.published_date] : null,
		}));
}

export function extractWebSourcesFromToolOutput(
	output: unknown,
): WebCitationSource[] {
	if (isBraveWebSearchResult(output)) {
		return extractBraveWebSources(output);
	}

	if (isStaanWebSearchResult(output)) {
		return extractStaanWebSources(output);
	}

	return [];
}

export const webSearchTool = tool({
	description: "Search the web for up-to-date information",
	inputSchema: z.object({ query: z.string() }),
	execute: async ({ query }) => {
		try {
			const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

			if (config.webSearchProvider === "brave") {
				if (!config.braveSearchApiKey) {
					throw new Error(
						"BRAVE_SEARCH_API_KEY is not configured but the brave web search provider is active",
					);
				}

				const res = await fetch(
					`${config.braveSearchApiUrl}?q=${encodeURIComponent(query)}&country=DE&search_lang=de&count=20`,
					{
						headers: {
							"X-Subscription-Token": config.braveSearchApiKey,
						},
						signal,
					},
				);

				if (!res.ok) {
					const error = (await res.json()) as WebSearchError;
					captureError(
						new Error(
							`Web search failed with status ${res.status}. Full error: ${JSON.stringify(error, null, 2)}`,
						),
					);
					return EMPTY_BRAVE_RESULT;
				}

				const data = (await res.json()) as BraveWebSearchResult;

				if (!data.grounding?.generic?.length) {
					return EMPTY_BRAVE_RESULT;
				}

				return data;
			} else if (config.webSearchProvider === "staan") {
				const res = await fetch(
					`${config.staanSearchApiUrl}/search/web?q=${encodeURIComponent(query)}&extra_snippets=true&max_snippets=5&min_score=0.2&market=de-de`,
					{
						headers: {
							Authorization: `Bearer ${config.staanSearchApiKey}`,
						},
						signal,
					},
				);

				if (!res.ok) {
					const error = (await res.json()) as WebSearchError;
					captureError(
						new Error(
							`Web search failed with status ${res.status}. Full error: ${JSON.stringify(error, null, 2)}`,
						),
					);
					return EMPTY_STAAN_RESULT;
				}

				const data = (await res.json()) as StaanWebSearchResult;

				if (!data.web?.results?.length) {
					return EMPTY_STAAN_RESULT;
				}

				return data;
			}
			throw new Error(
				`Unsupported web search provider: ${config.webSearchProvider}`,
			);
		} catch (error) {
			captureError(error);
			return config.webSearchProvider === "staan"
				? EMPTY_STAAN_RESULT
				: EMPTY_BRAVE_RESULT;
		}
	},
});
