import { expect, test, type Page } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import {
	mockLlmCompletion,
	sendAndWaitForLLMResponse,
	type LlmStreamEvent,
} from "../fixtures/mock-llm.ts";
import { supabaseAdminClient } from "../supabase.ts";

const TRACE_TEXT = "Ich prüfe zuerst die verfügbaren Quellen.";
const SECOND_TRACE_TEXT = "Die Treffer reichen für eine Antwort.";
const REMARK_TEXT = "Ich durchsuche jetzt das Web.";
const ANSWER_TEXT = "Die Antwort lautet 42.";

/** A step with a sentence before its tool call, then the answer step. */
const REMARK_BEFORE_TOOL_CALL_EVENTS: LlmStreamEvent[] = [
	{ type: "start-step" },
	{ type: "text-delta", id: "1", delta: REMARK_TEXT },
	{ type: "tool-input-start", toolCallId: "c1", toolName: "webSearchTool" },
	{ type: "tool-output-available", toolCallId: "c1" },
	{ type: "start-step" },
	{ type: "text-delta", id: "2", delta: ANSWER_TEXT },
];

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

async function setExtendedThinking(page: Page, isEnabled: boolean) {
	await page.addInitScript((isExtendedThinkingEnabled) => {
		localStorage.setItem(
			"extended-thinking",
			JSON.stringify({ state: { isExtendedThinkingEnabled }, version: 0 }),
		);
	}, isEnabled);
}

/** The remark is only in the trace; the answer is the last step's text. */
async function expectRemarkInTraceOnly(page: Page, userId: string) {
	const answer = page.getByText(ANSWER_TEXT, { exact: true });
	const remark = page.getByText(REMARK_TEXT);
	const summary = page.getByRole("button", { name: summaryName });

	await expect(answer).toBeVisible();
	await expect(remark).toBeHidden();

	await summary.click();
	await expect(remark).toBeVisible();

	await expect
		.poll(() => getLatestTraces(userId))
		.toEqual([
			{
				traces: [
					{ type: "text", text: REMARK_TEXT },
					{ type: "tool", tool: "webSearchTool" },
				],
				durationSeconds: expect.any(Number),
			},
		]);
}

/**
 * The live phases are not covered here: the reasoning-only phase (trace shown
 * in full under "BärGPT überlegt...", before any answer text arrives) and the
 * holding back of undecided step text. Playwright buffers a mocked stream
 * body, so the page only ever sees the completed response.
 */
test.describe("Thinking traces", () => {
	testWithMockedLlm(
		"collapses the trace behind a summary and persists it",
		async ({ page, account, isMobile }) => {
			await setExtendedThinking(page, true);
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
			// On mobile the chat history lives in a closed bottom drawer.
			if (isMobile === true) {
				await page.getByRole("button", { name: "Chat-Verlauf öffnen" }).click();
			}
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
			await setExtendedThinking(page, true);
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
					// The answer is a step of its own, as in a real stream.
					{ type: "start-step" },
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
			await setExtendedThinking(page, true);
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

	testWithMockedLlm(
		"shows the reasoning trace when extended thinking is off but the model reasons",
		async ({ page, account }) => {
			await setExtendedThinking(page, false);
			await mockLlmCompletion(page, {
				events: [
					{ type: "reasoning-delta", id: "r1", delta: TRACE_TEXT },
					{ type: "text-delta", id: "1", delta: ANSWER_TEXT },
				],
			});
			await page.goto("/");

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByText(ANSWER_TEXT);
			await expect(answer).toBeVisible();

			const summary = page.getByRole("button", { name: summaryName });
			const traceText = page.getByText(TRACE_TEXT);
			await expect(summary).toBeVisible();
			await expect(traceText).toBeHidden();

			await summary.click();
			await expect(traceText).toBeVisible();

			await expect
				.poll(() => getLatestTraces(account.id))
				.toEqual([
					{
						traces: [{ type: "text", text: TRACE_TEXT }],
						durationSeconds: expect.any(Number),
					},
				]);
		},
	);

	testWithMockedLlm(
		"shows no trace when extended thinking is off and the response carries no reasoning",
		async ({ page, account }) => {
			await setExtendedThinking(page, false);
			await mockLlmCompletion(page, {
				events: [
					{
						type: "tool-input-start",
						toolCallId: "c1",
						toolName: "webSearchTool",
					},
					{ type: "tool-output-available", toolCallId: "c1" },
					{ type: "start-step" },
					{ type: "text-delta", id: "1", delta: ANSWER_TEXT },
				],
			});
			await page.goto("/");

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByText(ANSWER_TEXT);
			const summary = page.getByRole("button", { name: summaryName });
			const summaryWithoutDuration = page.getByRole("button", {
				name: summaryWithoutDurationName,
			});
			const webSearchStep = page.getByText("Web durchsucht");
			await expect(answer).toBeVisible();
			await expect(summary).toHaveCount(0);
			await expect(summaryWithoutDuration).toHaveCount(0);
			await expect(webSearchStep).toHaveCount(0);

			await expect.poll(() => getLatestTraces(account.id)).toEqual([null]);
		},
	);

	testWithMockedLlm(
		"keeps tool steps in the trace when extended thinking is off but the model reasons",
		async ({ page, account }) => {
			await setExtendedThinking(page, false);
			await mockLlmCompletion(page, {
				events: [
					{ type: "reasoning-delta", id: "r1", delta: TRACE_TEXT },
					{
						type: "tool-input-start",
						toolCallId: "c1",
						toolName: "webSearchTool",
					},
					{ type: "tool-output-available", toolCallId: "c1" },
					{ type: "start-step" },
					{ type: "text-delta", id: "1", delta: ANSWER_TEXT },
				],
			});
			await page.goto("/");

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByText(ANSWER_TEXT);
			const summary = page.getByRole("button", { name: summaryName });
			const webSearchStep = page.getByText("Web durchsucht");
			await expect(answer).toBeVisible();
			await expect(summary).toBeVisible();

			await summary.click();
			await expect(webSearchStep).toHaveCount(1);

			await expect
				.poll(() => getLatestTraces(account.id))
				.toEqual([
					{
						traces: [
							{ type: "text", text: TRACE_TEXT },
							{ type: "tool", tool: "webSearchTool" },
						],
						durationSeconds: expect.any(Number),
					},
				]);
		},
	);

	testWithMockedLlm(
		"moves text before a tool call into the trace instead of the answer",
		async ({ page, account }) => {
			await setExtendedThinking(page, true);
			await mockLlmCompletion(page, {
				events: REMARK_BEFORE_TOOL_CALL_EVENTS,
			});
			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("hallo");
			await sendAndWaitForLLMResponse(page);

			await expectRemarkInTraceOnly(page, account.id);
		},
	);

	testWithMockedLlm(
		"moves text before a tool call into the trace when a tool is selected",
		async ({ page, account, isMobile }) => {
			testWithMockedLlm.skip(isMobile === true, "desktop-only menu flow");

			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testWithMockedLlm.skip();
			}

			await setExtendedThinking(page, true);
			await mockLlmCompletion(page, {
				events: REMARK_BEFORE_TOOL_CALL_EVENTS,
			});
			await page.goto("/");

			// With a tool selected, step text is held back until it is decided.
			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const chatInput = page.getByPlaceholder("Das Web durchsuchen");
			await chatInput.fill("hallo");
			await sendAndWaitForLLMResponse(page);

			await expectRemarkInTraceOnly(page, account.id);
		},
	);

	testWithMockedLlm(
		"keeps reasoning from different steps as separate trace entries",
		async ({ page, account }) => {
			await setExtendedThinking(page, true);
			await mockLlmCompletion(page, {
				events: [
					{ type: "start-step" },
					{ type: "reasoning-delta", id: "r1", delta: TRACE_TEXT },
					// A tool without a trace step, so nothing separates the reasoning.
					{
						type: "tool-input-start",
						toolCallId: "c1",
						toolName: "search_berlin_datasets",
					},
					{ type: "tool-output-available", toolCallId: "c1" },
					{ type: "start-step" },
					{ type: "reasoning-delta", id: "r2", delta: SECOND_TRACE_TEXT },
					{ type: "text-delta", id: "1", delta: ANSWER_TEXT },
				],
			});
			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("hallo");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByText(ANSWER_TEXT, { exact: true });
			await expect(answer).toBeVisible();

			await expect
				.poll(() => getLatestTraces(account.id))
				.toEqual([
					{
						traces: [
							{ type: "text", text: TRACE_TEXT },
							{ type: "text", text: SECOND_TRACE_TEXT },
						],
						durationSeconds: expect.any(Number),
					},
				]);
		},
	);
});
