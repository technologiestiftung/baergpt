import { expect, test } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import {
	mockLlmCompletion,
	sendAndWaitForLLMResponse,
} from "../fixtures/mock-llm.ts";
import { supabaseAdminClient } from "../supabase.ts";

const TRACE_TEXT = "Ich prüfe zuerst die verfügbaren Quellen.";
const ANSWER_TEXT = "Die Antwort lautet 42.";

const summaryName = /Nachgedacht für \d+ Sekunden/;
const summaryWithoutDurationName = "Gedankengang";

async function getLatestTraces(userId: string): Promise<Array<unknown>> {
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
		.select("traces")
		.eq("chat_id", chatId)
		.eq("role", "assistant")
		.order("id", { ascending: true });

	if (messagesError) {
		throw messagesError;
	}

	return (messages ?? []).map(({ traces }) => traces);
}

/**
 * The reasoning-only phase (trace shown in full under "BärGPT überlegt...",
 * before any answer text arrives) is not covered here: Playwright buffers a
 * mocked stream body, so the page only ever sees the completed response.
 */
test.describe("Thinking traces", () => {
	testWithMockedLlm(
		"collapses the trace behind a summary and persists it",
		async ({ page, account }) => {
			await mockLlmCompletion(page, {
				events: [
					{ type: "reasoning-delta", id: "r1", delta: TRACE_TEXT },
					{ type: "text-delta", id: "1", delta: ANSWER_TEXT },
				],
			});

			await page.goto("/");
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			await expect(page.getByText(ANSWER_TEXT)).toBeVisible();

			// Collapsed by default, labelled with the duration measured live.
			const summary = page.getByRole("button", { name: summaryName });
			await expect(summary).toBeVisible();
			await expect(page.getByText(TRACE_TEXT)).toBeHidden();

			await summary.click();
			await expect(page.getByText(TRACE_TEXT)).toBeVisible();

			await expect
				.poll(() => getLatestTraces(account.id))
				.toEqual([
					{
						traces: [{ type: "text", text: TRACE_TEXT }],
						durationSeconds: expect.any(Number),
					},
				]);

			// The duration is stored with the trace, so it survives a reload.
			await page.reload();
			await page.getByRole("button", { name: "hallo" }).click();
			await expect(page.getByText(ANSWER_TEXT)).toBeVisible();

			const reloadedSummary = page.getByRole("button", { name: summaryName });
			await expect(reloadedSummary).toBeVisible();
			await reloadedSummary.click();
			await expect(page.getByText(TRACE_TEXT)).toBeVisible();
		},
	);

	testWithMockedLlm(
		"renders one step per tool, collapsing consecutive calls of the same tool",
		async ({ page, account }) => {
			await mockLlmCompletion(page, {
				events: [
					{ type: "reasoning-delta", id: "r1", delta: TRACE_TEXT },
					{
						type: "tool-input-start",
						toolCallId: "c1",
						toolName: "webSearchTool",
					},
					{ type: "tool-output-available", toolCallId: "c1" },
					// Second call of the same tool — one step, not two.
					{
						type: "tool-input-start",
						toolCallId: "c2",
						toolName: "webSearchTool",
					},
					{ type: "tool-output-available", toolCallId: "c2" },
					{
						type: "tool-input-start",
						toolCallId: "c3",
						toolName: "parla_vector_search",
					},
					{ type: "tool-output-available", toolCallId: "c3" },
					// Out of scope for now — must not render a step.
					{
						type: "tool-input-start",
						toolCallId: "c4",
						toolName: "search_berlin_datasets",
					},
					{ type: "tool-output-available", toolCallId: "c4" },
					{ type: "text-delta", id: "1", delta: ANSWER_TEXT },
				],
			});

			await page.goto("/");
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			await expect(page.getByText(ANSWER_TEXT)).toBeVisible();
			await page.getByRole("button", { name: summaryName }).click();

			await expect(page.getByText("Web durchsucht")).toHaveCount(1);
			await expect(
				page.getByText("Ich habe passende Webseiten gefunden."),
			).toBeVisible();
			await expect(page.getByText("Parla durchsucht")).toHaveCount(1);
			await expect(page.getByText("Dokumente durchsucht")).toHaveCount(0);

			await expect
				.poll(() => getLatestTraces(account.id))
				.toEqual([
					{
						traces: [
							{ type: "text", text: TRACE_TEXT },
							{ type: "tool", tool: "webSearchTool" },
							{ type: "tool", tool: "parlaMCPTools" },
						],
						durationSeconds: expect.any(Number),
					},
				]);
		},
	);

	testWithMockedLlm(
		"renders no summary when the response carries no trace",
		async ({ page, account }) => {
			await page.goto("/");

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			await expect(page.getByText("Test response.")).toBeVisible();
			await expect(page.getByRole("button", { name: summaryName })).toHaveCount(
				0,
			);
			await expect(
				page.getByRole("button", { name: summaryWithoutDurationName }),
			).toHaveCount(0);

			await expect.poll(() => getLatestTraces(account.id)).toEqual([null]);
		},
	);
});
