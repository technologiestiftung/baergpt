import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { getEncoding } from "js-tiktoken";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";

/**
 * Frontend stress test for large contexts. Not part of `test:e2e`.
 *
 * Playwright's `route.fulfill` delivers a mocked body in one piece, so the
 * page never really streams. Instead, `window.fetch` is replaced for
 * `/llm/just-chatting` with a ReadableStream that emits one text delta per
 * tick, like the real backend does.
 *
 * Run (Chromium only, one worker so runs do not compete for CPU):
 *   npx playwright test tests/perf --project=chromium --workers=1
 */

const encoding = getEncoding("cl100k_base");
const END_MARKER = "STRESS-ENDE";
const RESULTS_DIR = "test-results/perf";

/** ~4 tokens per delta every 20 ms ≈ 200 tokens/s, a fast hosted model. */
const DELTA_INTERVAL_MS = 20;
const TOKENS_PER_DELTA = 4;

const markdownBlocks = [
	"## Abschnitt zur Verwaltungsdigitalisierung\n\n",
	"Die Senatsverwaltung prüft derzeit, wie **digitale Antragsverfahren** schneller bearbeitet werden können. Dabei stehen Datenschutz, Barrierefreiheit und die Anbindung an bestehende Fachverfahren im Mittelpunkt.\n\n",
	"- Erstens: Prozesse werden vor der Digitalisierung vereinfacht.\n- Zweitens: Schnittstellen folgen offenen Standards.\n- Drittens: Nutzerinnen und Nutzer testen früh mit.\n\n",
	"| Bezirk | Anträge | Bearbeitungszeit |\n| --- | --- | --- |\n| Mitte | 1.204 | 12 Tage |\n| Pankow | 987 | 9 Tage |\n\n",
	"Im Ergebnis zeigt sich, dass *klare Zuständigkeiten* und eine gemeinsame Datenbasis die wichtigsten Erfolgsfaktoren sind. Weitere Details finden sich in der [Dokumentation](https://example.org/doku).\n\n",
];

const blockTokenCounts = markdownBlocks.map(
	(block) => encoding.encode(block).length,
);

/** Builds markdown of exactly `targetTokens` tokens. */
function buildMarkdown(targetTokens: number): string {
	const parts: string[] = [];
	let tokens = 0;
	for (let i = 0; tokens < targetTokens; i++) {
		parts.push(markdownBlocks[i % markdownBlocks.length]);
		tokens += blockTokenCounts[i % markdownBlocks.length];
	}
	// The last block overshoots the target, so cut at the exact token count.
	return encoding.decode(
		encoding.encode(parts.join("")).slice(0, targetTokens),
	);
}

function splitIntoDeltas(text: string, tokensPerDelta = TOKENS_PER_DELTA) {
	const tokens = encoding.encode(text);
	const deltas: string[] = [];
	for (let i = 0; i < tokens.length; i += tokensPerDelta) {
		deltas.push(encoding.decode(tokens.slice(i, i + tokensPerDelta)));
	}
	deltas.push(` ${END_MARKER}`);
	return deltas;
}

/** Streaming fetch stub and frame/long-task recorders, installed before load. */
async function installStressHarness(page: Page) {
	await page.addInitScript(
		({ defaultIntervalMs }) => {
			const w = window as unknown as Record<string, unknown>;
			const metrics = {
				recording: false,
				longTasks: [] as number[],
				frameGaps: [] as number[],
				streamStart: 0,
				streamEnd: 0,
			};
			w.__stressMetrics = metrics;

			new PerformanceObserver((list) => {
				if (!metrics.recording) {
					return;
				}
				for (const entry of list.getEntries()) {
					metrics.longTasks.push(entry.duration);
				}
			}).observe({ type: "longtask", buffered: false });

			let lastFrame = performance.now();
			const onFrame = (now: number) => {
				if (metrics.recording) {
					metrics.frameGaps.push(now - lastFrame);
				}
				lastFrame = now;
				requestAnimationFrame(onFrame);
			};
			requestAnimationFrame(onFrame);

			const originalFetch = window.fetch.bind(window);
			window.fetch = async (input, init) => {
				const url = typeof input === "string" ? input : String(input);
				if (!url.includes("/llm/just-chatting")) {
					return originalFetch(input, init);
				}
				const deltas = (w.__stressDeltas as string[]) ?? ["leer"];
				const intervalMs =
					(w.__stressIntervalMs as number | undefined) ?? defaultIntervalMs;
				const encoder = new TextEncoder();
				let index = 0;
				const stream = new ReadableStream<Uint8Array>({
					start() {
						metrics.streamStart = performance.now();
					},
					pull(controller) {
						return new Promise((resolve) => {
							setTimeout(() => {
								if (index < deltas.length) {
									const event = {
										type: "text-delta",
										id: "1",
										delta: deltas[index++],
									};
									controller.enqueue(
										encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
									);
								} else {
									controller.enqueue(encoder.encode("data: [DONE]\n\n"));
									controller.close();
									metrics.streamEnd = performance.now();
								}
								resolve();
							}, intervalMs);
						});
					},
				});
				return new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/event-stream; charset=utf-8" },
				});
			};
		},
		{ defaultIntervalMs: DELTA_INTERVAL_MS },
	);
}

type StressMetrics = {
	recording: boolean;
	longTasks: number[];
	frameGaps: number[];
	streamStart: number;
	streamEnd: number;
};

type Scenario = {
	name: string;
	promptTokens: number;
	answerTokens: number;
	/** Earlier question/answer pairs sent before the measured turn. */
	historyTurns?: number;
	historyAnswerTokens?: number;
};

type Result = Scenario & {
	pasteMs: number;
	sendToUserMessageMs: number;
	idealStreamMs: number;
	actualStreamMs: number;
	slowdown: number;
	longTaskCount: number;
	totalBlockingMs: number;
	maxFrameGapMs: number;
	p95FrameGapMs: number;
	framesOver100Ms: number;
	heapMb: number | null;
};

/** Sets what the stubbed `/llm/just-chatting` streams on the next send. */
async function setNextAnswer(
	page: Page,
	deltas: string[],
	intervalMs = DELTA_INTERVAL_MS,
) {
	await page.evaluate(
		({ d, ms }) => {
			const w = window as unknown as Record<string, unknown>;
			w.__stressDeltas = d;
			w.__stressIntervalMs = ms;
		},
		{ d: deltas, ms: intervalMs },
	);
}

/**
 * Pastes through the clipboard like a user would. `locator.fill` is far
 * slower for large text (~13 s for 250 KB even in a bare textarea).
 */
async function pastePrompt(page: Page, prompt: string) {
	await page.evaluate((text) => navigator.clipboard.writeText(text), prompt);
	const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
	await chatInput.focus();
	const pasteStart = Date.now();
	await page.keyboard.press("ControlOrMeta+V");
	await expect(chatInput).toHaveJSProperty("value", prompt, {
		timeout: 600_000,
	});
	return Date.now() - pasteStart;
}

/** Sends the pasted prompt and returns the ms until it is rendered. */
async function sendTurn(page: Page) {
	const userMessages = page.getByTestId("user-message-markdown-container");
	const userMessageCount = await userMessages.count();
	const sendStart = Date.now();
	await page.getByRole("button", { name: "Nachricht senden" }).click();
	await expect(userMessages).toHaveCount(userMessageCount + 1, {
		timeout: 600_000,
	});
	return Date.now() - sendStart;
}

async function waitForAnswer(page: Page, answerCount: number, timeout: number) {
	const answers = page.getByTestId("assistant-message-markdown-container");
	await expect(answers).toHaveCount(answerCount, { timeout });
	await expect(answers.last()).toContainText(END_MARKER, { timeout });
	// Buttons only render once the stream has settled.
	await expect(page.getByRole("button", { name: "Exportieren" })).toHaveCount(
		answerCount,
		{ timeout },
	);
}

function percentile(values: number[], p: number) {
	if (!values.length) {
		return 0;
	}
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function runScenario(page: Page, scenario: Scenario): Promise<Result> {
	await installStressHarness(page);
	await page.goto("/");

	// History answers arrive in big, fast chunks: only the measured turn
	// needs a realistic stream.
	const historyDeltas = splitIntoDeltas(
		buildMarkdown(scenario.historyAnswerTokens ?? 500),
		500,
	);
	for (let i = 0; i < (scenario.historyTurns ?? 0); i++) {
		await setNextAnswer(page, historyDeltas, 1);
		await pastePrompt(page, `Frage ${i + 1}`);
		await sendTurn(page);
		await waitForAnswer(page, i + 1, 600_000);
	}

	const prompt = buildMarkdown(scenario.promptTokens);
	const deltas = splitIntoDeltas(buildMarkdown(scenario.answerTokens));

	await setNextAnswer(page, deltas);
	const pasteMs = await pastePrompt(page, prompt);

	// Record from send on, so the paste itself is not counted.
	await page.evaluate(() => {
		const m = (window as unknown as { __stressMetrics: StressMetrics })
			.__stressMetrics;
		m.longTasks = [];
		m.frameGaps = [];
		m.recording = true;
	});

	const sendToUserMessageMs = await sendTurn(page);
	const idealStreamMs = (deltas.length + 1) * DELTA_INTERVAL_MS;
	await waitForAnswer(
		page,
		(scenario.historyTurns ?? 0) + 1,
		Math.max(120_000, idealStreamMs * 20),
	);

	const metrics = await page.evaluate(() => {
		const m = (window as unknown as { __stressMetrics: StressMetrics })
			.__stressMetrics;
		m.recording = false;
		const memory = (
			performance as unknown as { memory?: { usedJSHeapSize: number } }
		).memory;
		return {
			longTasks: m.longTasks,
			frameGaps: m.frameGaps,
			actualStreamMs: m.streamEnd - m.streamStart,
			heapMb: memory ? memory.usedJSHeapSize / 1024 / 1024 : null,
		};
	});

	return {
		...scenario,
		pasteMs,
		sendToUserMessageMs,
		idealStreamMs,
		actualStreamMs: Math.round(metrics.actualStreamMs),
		slowdown: Number((metrics.actualStreamMs / idealStreamMs).toFixed(2)),
		longTaskCount: metrics.longTasks.length,
		totalBlockingMs: Math.round(
			metrics.longTasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
		),
		maxFrameGapMs: Math.round(Math.max(0, ...metrics.frameGaps)),
		p95FrameGapMs: Math.round(percentile(metrics.frameGaps, 0.95)),
		framesOver100Ms: metrics.frameGaps.filter((gap) => gap > 100).length,
		heapMb: metrics.heapMb === null ? null : Math.round(metrics.heapMb),
	};
}

/**
 * Limits from the backend (`apps/backend/src/constants.ts`): answers stop at
 * 8,192 tokens, or 24,576 with extended thinking. GLM 5.3 has a 1M-token
 * context window.
 */
const scenarios: Scenario[] = [
	// Long answers, short question
	...[1_000, 4_000, 8_192, 16_000, 24_576].map((answerTokens) => ({
		name: `answer-${answerTokens}`,
		promptTokens: 20,
		answerTokens,
	})),
	// Large pasted prompts, fixed 1k answer
	...[8_000, 32_000, 128_000, 256_000, 512_000, 1_000_000].map(
		(promptTokens) => ({
			name: `prompt-${promptTokens}`,
			promptTokens,
			answerTokens: 1_000,
		}),
	),
	// Long conversations of 8k-token answers (up to ~1M tokens), fixed 1k answer
	...[10, 30, 60, 120].map((historyTurns) => ({
		name: `history-${historyTurns}x8k`,
		promptTokens: 20,
		answerTokens: 1_000,
		historyTurns,
		historyAnswerTokens: 8_192,
	})),
];

const only = process.env.STRESS_ONLY?.split(",");

testWithLoggedInUser.describe("Context stress", () => {
	for (const scenario of scenarios) {
		if (only && !only.includes(scenario.name)) {
			continue;
		}
		testWithLoggedInUser(scenario.name, async ({ page, browserName }) => {
			testWithLoggedInUser.skip(browserName !== "chromium", "Chromium only");
			testWithLoggedInUser.setTimeout(60 * 60_000);

			const result = await runScenario(page, scenario);
			process.stdout.write(`${JSON.stringify(result)}\n`);
			mkdirSync(RESULTS_DIR, { recursive: true });
			writeFileSync(
				`${RESULTS_DIR}/${scenario.name}.json`,
				JSON.stringify(result, null, 2),
			);
		});
	}
});
