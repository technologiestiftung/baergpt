import type { Page } from "@playwright/test";

export type LlmWebCitation = {
	url: string;
	title: string;
	snippet: string;
	age?: string[] | null;
};

/** Matches stream payloads consumed by `parseStream` in get-completion.ts */
export type LlmStreamEvent =
	| { type: "text-delta"; id: string; delta: string }
	| { type: "data-citations"; data: number[] }
	| { type: "data-web-citations"; data: LlmWebCitation[] };

export const DEFAULT_LLM_DELTA = "Test response.";

export function buildSseStream(events: LlmStreamEvent[]): string {
	const lines = events.map((event) => `data: ${JSON.stringify(event)}\n\n`);
	return `${lines.join("")}data: [DONE]\n\n`;
}

export type MockLlmCompletionOptions = {
	/** Full SSE body (must end with `data: [DONE]\\n\\n` if you want a clean client finish) */
	body?: string;
	events?: LlmStreamEvent[];
	textDelta?: string;
	citations?: number[];
	webCitations?: LlmWebCitation[];
	delayMs?: number;
	status?: number;
};

export async function mockLlmCompletion(
	page: Page,
	options: MockLlmCompletionOptions = {},
): Promise<void> {
	const {
		status = 200,
		delayMs = 0,
		body,
		events,
		textDelta = DEFAULT_LLM_DELTA,
		citations,
		webCitations,
	} = options;

	await page.unroute("**/llm/just-chatting");

	await page.route("**/llm/just-chatting", async (route) => {
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
		if (status !== 200) {
			await route.fulfill({
				status,
				contentType: "application/json",
				body: JSON.stringify({ code: "mock_error" }),
			});
			return;
		}

		let streamBody: string;
		if (body !== undefined) {
			streamBody = body;
		} else if (events !== undefined) {
			streamBody = buildSseStream(events);
		} else {
			const evts: LlmStreamEvent[] = [
				{ type: "text-delta", id: "1", delta: textDelta },
			];
			if (citations !== undefined && citations.length > 0) {
				evts.push({ type: "data-citations", data: citations });
			}
			if (webCitations !== undefined && webCitations.length > 0) {
				evts.push({ type: "data-web-citations", data: webCitations });
			}
			streamBody = buildSseStream(evts);
		}

		await route.fulfill({
			status: 200,
			headers: { "Content-Type": "text/event-stream; charset=utf-8" },
			body: streamBody,
		});
	});
}

/** Clicks send and waits for the mocked or real `/llm/just-chatting` response. */
export async function sendAndWaitForLLMResponse(page: Page): Promise<void> {
	const waitForLLMResponse = page.waitForResponse("**/llm/just-chatting");

	const sendButton = page.getByRole("button", {
		name: "Nachricht senden",
	});
	await sendButton.click();

	await waitForLLMResponse;
}
