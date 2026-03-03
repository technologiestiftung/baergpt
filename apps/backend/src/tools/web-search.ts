import { tool } from "ai";
import { z } from "zod";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";

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
			hostname: string;
			age: string[];
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
		const { signal, cancel } = createTimeoutSignal(REQUEST_TIMEOUT_MS);

		try {
			const res = await fetch(
				`https://api.search.brave.com/res/v1/llm/context?q=${encodeURIComponent(query)}&country=DE&search_lang=de&count=20`,
				{
					headers: { "X-Subscription-Token": config.braveSearchApiKey },
					signal,
				},
			);

			if (!res.ok) {
				captureError(
					new Error(`Brave search failed with status ${res.status}`),
				);
				return EMPTY_RESULT;
			}

			await waitForRateLimitReset(res.headers);

			const data = (await res.json()) as WebSearchResult;

			if (!data.grounding?.generic?.length) {
				return EMPTY_RESULT;
			}

			return data;
		} catch (error) {
			captureError(error);
			return EMPTY_RESULT;
		} finally {
			cancel();
		}
	},
});

function createTimeoutSignal(timeoutMs: number): {
	signal: AbortSignal;
	cancel: () => void;
} {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	return { signal: controller.signal, cancel: () => clearTimeout(timeoutId) };
}

async function waitForRateLimitReset(headers: Headers): Promise<void> {
	const rateLimitRemaining = headers.get("X-RateLimit-Remaining");
	const rateLimitReset = headers.get("X-RateLimit-Reset");
	if (
		rateLimitRemaining !== null &&
		parseInt(rateLimitRemaining, 10) === 0 &&
		rateLimitReset
	) {
		const firstToken =
			rateLimitReset
				.split(",")
				.find((t) => t.trim() !== "")
				?.trim() ?? "";
		const seconds = parseInt(firstToken, 10);
		const waitMs = Math.max(seconds * 1000, 0);
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}
}
