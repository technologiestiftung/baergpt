import { expect, type Page } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";
import { testWithChatSearch } from "../fixtures/test-with-chat-search.ts";

const LONG_PROMPT = Array.from(
	{ length: 60 },
	(_, index) => `Frage ${index + 1}: Welche Unterlagen sind einzureichen?`,
).join("\n\n");

const toggleName = /^(Mehr|Weniger) anzeigen$/;

/** Mirrors `max-h-[min(32rem,40dvh)]` in `collapsible-prompt.tsx`. */
function getMaxCollapsedHeight(page: Page) {
	const viewportHeight = page.viewportSize()?.height ?? 0;
	return Math.min(512, viewportHeight * 0.4);
}

async function getPromptHeight(page: Page) {
	const controlsId = await page
		.getByRole("button", { name: toggleName })
		.getAttribute("aria-controls");
	const box = await page.locator(`[id="${controlsId}"]`).boundingBox();
	return box?.height ?? 0;
}

testWithMockedLlm(
	"collapses a long prompt and toggles it with mouse and keyboard",
	async ({ page }) => {
		await page.goto("/");
		await page.getByPlaceholder("Stellen Sie eine Frage").fill(LONG_PROMPT);
		await sendAndWaitForLLMResponse(page);
		await expect(page.getByText("Test response.")).toBeInViewport();

		const showMore = page.getByRole("button", { name: "Mehr anzeigen" });
		await expect(showMore).toHaveAttribute("aria-expanded", "false");
		const collapsedHeight = await getPromptHeight(page);
		expect(collapsedHeight).toBeLessThanOrEqual(
			Math.ceil(getMaxCollapsedHeight(page)),
		);

		await showMore.click();
		const showLess = page.getByRole("button", { name: "Weniger anzeigen" });
		await expect(showLess).toHaveAttribute("aria-expanded", "true");
		expect(await getPromptHeight(page)).toBeGreaterThan(collapsedHeight);

		await showLess.focus();
		await page.keyboard.press("Enter");
		await expect(showMore).toHaveAttribute("aria-expanded", "false");
		await expect(
			page
				.getByTestId("user-message-markdown-container")
				.getByText("Frage 1:", { exact: false }),
		).toBeInViewport();
		await expect(showMore).toBeInViewport();

		await showMore.focus();
		await page.keyboard.press("Space");
		await expect(showLess).toBeVisible();
	},
);

testWithMockedLlm("shows no toggle for a short prompt", async ({ page }) => {
	await page.goto("/");
	await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
	await sendAndWaitForLLMResponse(page);

	await expect(page.getByText("Test response.")).toBeVisible();
	await expect(page.getByRole("button", { name: toggleName })).toHaveCount(0);
});

testWithChatSearch(
	"expands a collapsed prompt when a search match is in its hidden part",
	async ({ page, insertChat, insertMessages }) => {
		const chatId = await insertChat("Langer Prompt", new Date());
		await insertMessages(chatId, [
			{
				role: "user",
				content: `${LONG_PROMPT}\n\nWie hoch ist die Grundsteuer?`,
				createdAt: new Date(),
			},
		]);

		await page.goto("/");
		await page.getByRole("button", { name: "Chatsuche öffnen" }).click();
		const searchInput = page.getByRole("combobox", {
			name: "Chats durchsuchen...",
		});
		await searchInput.fill("Grundsteuer");
		await expect(page.getByRole("option")).toHaveCount(1);
		await searchInput.press("Enter");

		await expect(
			page.getByRole("button", { name: "Weniger anzeigen" }),
		).toHaveAttribute("aria-expanded", "true");
		await expect(
			page
				.getByTestId("user-message-markdown-container")
				.getByText("Wie hoch ist die Grundsteuer?"),
		).toBeInViewport();
	},
);
