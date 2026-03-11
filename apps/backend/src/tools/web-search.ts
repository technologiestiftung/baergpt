import { tool } from "ai";
import { z } from "zod";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
import { resilientCall } from "../utils";

export type WebSearchResult = {
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

const EMPTY_RESULT: WebSearchResult = {
	grounding: { generic: [] },
	sources: {},
};
const REQUEST_TIMEOUT_MS = 30_000;

export const webSearchTool = tool({
	description: "Search the web for up-to-date information",
	inputSchema: z.object({ query: z.string() }),
	execute: async ({ query }) => {
		try {
			const res = await resilientCall(
				async () => {
					const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

					return fetch(
						`${config.braveSearchApiUrl}?q=${encodeURIComponent(query)}&country=DE&search_lang=de&count=20`,
						{
							headers: {
								"X-Subscription-Token": config.braveSearchApiKey,
							},
							signal,
						},
					);
				},
				{ queueType: "webSearch" },
			);

			if (!res.ok) {
				const error = (await res.json()) as {
					errors: {
						code: string;
						detail: string;
					}[];
				};
				captureError(
					new Error(
						`Brave search failed with status ${res.status} ${error.errors[0].code}: ${error.errors[0].detail}`,
					),
				);
				return EMPTY_RESULT;
			}

			const data = (await res.json()) as WebSearchResult;

			if (!data.grounding?.generic?.length) {
				return EMPTY_RESULT;
			}

			return data;
		} catch (error) {
			captureError(error);
			return EMPTY_RESULT;
		}
	},
});
