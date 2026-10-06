import { Readable } from "node:stream";
import { expect, test } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";
import { supabaseAdminClient } from "../supabase.ts";

type PersistedMessage = {
	role: string;
	content: string;
};

async function getMessagesForLatestChat(
	userId: string,
): Promise<PersistedMessage[]> {
	const { data: chats, error: chatsError } = await supabaseAdminClient
		.from("chats")
		.select("id")
		.eq("user_id", userId)
		.order("created_at", { ascending: false })
		.limit(1);

	if (chatsError) {
		throw chatsError;
	}

	const chatId = chats?.[0]?.id;
	if (chatId === undefined) {
		return [];
	}

	const { data: messages, error: messagesError } = await supabaseAdminClient
		.from("chat_messages")
		.select("role, content")
		.eq("chat_id", chatId)
		.order("id", { ascending: true });

	if (messagesError) {
		throw messagesError;
	}

	return messages ?? [];
}

test.describe("Chat message persistence", () => {
	testWithMockedLlm(
		"a stream that ends abnormally (no [DONE]) leaves no empty assistant message behind",
		async ({ page, account }) => {
			await page.goto("/");

			// SSE body that ends without the `data: [DONE]` trailer — simulates a
			// dropped connection. `parseStream`'s fallback path should kick in and
			// the optimistic assistant placeholder should never reach the DB.
			await page.route("**/llm/just-chatting", async (route) => {
				await route.fulfill({
					status: 200,
					headers: { "Content-Type": "text/event-stream; charset=utf-8" },
					body: `data: ${JSON.stringify({
						type: "text-delta",
						id: "1",
						delta: "Partial answer",
					})}\n\n`,
				});
			});

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			// The local placeholder is dropped from the UI once the abnormal end
			// is detected.
			await expect(
				page.getByTestId("assistant-message-markdown-container"),
			).toHaveCount(0);

			// Only the user's message was ever written to the database — no
			// empty-content assistant row.
			await expect
				.poll(() => getMessagesForLatestChat(account.id))
				.toEqual([{ role: "user", content: "hallo" }]);
		},
	);

	testWithLoggedInUser(
		"aborting a response before it finishes leaves no empty assistant message behind",
		async ({ page, account }) => {
			await page.goto("/");
			let hangingStream: Readable | undefined;

			// Mock the LLM API to hang after a partial response, so the user has
			// time to click "stop" before the stream would ever settle naturally.
			await page.route("**/llm/just-chatting", async (route) => {
				hangingStream = new Readable({
					read() {},
				});
				hangingStream.push(
					`data: ${JSON.stringify({
						type: "text-delta",
						id: "1",
						delta: "Partial ",
					})}\n\n`,
				);

				await route.fulfill({
					status: 200,
					headers: {
						"Content-Type": "text/event-stream; charset=utf-8",
					},
					// @ts-expect-error Playwright Node accepts Readable for streaming bodies; public types omit it.
					body: hangingStream,
				});
			});

			try {
				await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
				await page.getByRole("button", { name: "Nachricht senden" }).click();

				const stopButton = page.getByRole("button", {
					name: "Textgenerierung stoppen",
				});
				await expect(stopButton).toBeVisible();

				await stopButton.click();

				await expect(
					page.getByRole("button", { name: "Nachricht senden" }),
				).toBeVisible();

				// The aborted turn's optimistic placeholder is dropped from the UI...
				await expect(
					page.getByTestId("assistant-message-markdown-container"),
				).toHaveCount(0);

				// ...and only the user's message was ever written to the database.
				await expect
					.poll(() => getMessagesForLatestChat(account.id))
					.toEqual([{ role: "user", content: "hallo" }]);
			} finally {
				await page.unroute("**/llm/just-chatting");
				hangingStream?.destroy();
			}
		},
	);

	testWithMockedLlm(
		"a stream that completes with only whitespace content leaves no empty assistant message behind",
		async ({ page, account }) => {
			await page.goto("/");

			await page.route("**/llm/just-chatting", async (route) => {
				await route.fulfill({
					status: 200,
					headers: { "Content-Type": "text/event-stream; charset=utf-8" },
					body: `data: ${JSON.stringify({
						type: "text-delta",
						id: "1",
						delta: "   \n\t  ",
					})}\n\ndata: [DONE]\n\n`,
				});
			});

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			// The whitespace-only placeholder is dropped from the UI, same as a
			// truly empty response.
			await expect(
				page.getByTestId("assistant-message-markdown-container"),
			).toHaveCount(0);

			// Only the user's message was ever written to the database — no
			// whitespace-only assistant row.
			await expect
				.poll(() => getMessagesForLatestChat(account.id))
				.toEqual([{ role: "user", content: "hallo" }]);
		},
	);

	testWithMockedLlm(
		"a successful, fully-streamed response persists the assistant message",
		async ({ page, account }) => {
			await page.goto("/");

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			await expect
				.poll(() => getMessagesForLatestChat(account.id))
				.toEqual([
					{ role: "user", content: "hallo" },
					{ role: "assistant", content: "Test response." },
				]);
		},
	);
});
