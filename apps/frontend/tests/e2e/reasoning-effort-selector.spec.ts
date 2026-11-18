import { expect, type Page } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";

const fastModelLabel = "Schnell";
const preciseModelOptionName = "Mistral Large 4 (ausgewogen) auswählen";

function openModelDropdown(page: Page, triggerLabel = fastModelLabel) {
	return page.getByRole("button", { name: triggerLabel, exact: false }).click();
}

function reasoningGroup(page: Page) {
	return page.getByRole("radiogroup", { name: "Denkaufwand" });
}

function radio(page: Page, name: string) {
	return reasoningGroup(page).getByRole("radio", { name, exact: true });
}

/** Reads `reasoning_effort` off the next completion request the page makes. */
function captureReasoningEffort(page: Page): Promise<string> {
	return page
		.waitForRequest("**/llm/just-chatting")
		.then((request) => request.postDataJSON().reasoning_effort as string);
}

testWithMockedLlm.describe("Reasoning effort selector", () => {
	testWithMockedLlm(
		"is a radiogroup with four levels and defaults to Aus",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);

			await expect(reasoningGroup(page)).toBeVisible();
			await expect(reasoningGroup(page).getByRole("radio")).toHaveCount(4);
			await expect(radio(page, "Aus")).toBeChecked();
			await expect(
				page.getByText("Antwortet direkt, ohne vorher nachzudenken."),
			).toBeVisible();

			await radio(page, "Mittel").click();
			await expect(radio(page, "Mittel")).toBeChecked();
			await expect(
				page.getByText("Gründliches Planen für die meisten Aufgaben."),
			).toBeVisible();
		},
	);

	testWithMockedLlm(
		"shows a non-default level on the trigger button",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);
			await radio(page, "Hoch").click();
			await page.keyboard.press("Escape");

			await expect(
				page.getByRole("button", { name: "Schnell · Hoch", exact: false }),
			).toBeVisible();
		},
	);

	testWithMockedLlm(
		"survives selecting a different model and a page reload",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);
			await radio(page, "Niedrig").click();

			// Picking a model closes the dropdown, so reopen it.
			await page.getByRole("option", { name: preciseModelOptionName }).click();
			await openModelDropdown(page, "Ausgewogen");
			await expect(radio(page, "Niedrig")).toBeChecked();

			await page.reload();
			await openModelDropdown(page, "Ausgewogen");
			await expect(radio(page, "Niedrig")).toBeChecked();
		},
	);

	testWithMockedLlm(
		"migrates the old extended-thinking switch to Hoch",
		async ({ page }) => {
			await page.addInitScript(() => {
				localStorage.setItem(
					"extended-thinking",
					JSON.stringify({
						state: { isExtendedThinkingEnabled: true },
						version: 0,
					}),
				);
			});
			await page.goto("/");
			await openModelDropdown(page, "Schnell · Hoch");

			await expect(radio(page, "Hoch")).toBeChecked();
		},
	);

	testWithMockedLlm(
		"sends the level with the next message and not before",
		async ({ page }) => {
			await page.goto("/");
			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");

			const first = captureReasoningEffort(page);
			await chatInput.fill("Erste Frage");
			await sendAndWaitForLLMResponse(page);
			expect(await first).toBe("none");

			await openModelDropdown(page);
			await radio(page, "Mittel").click();
			await page.keyboard.press("Escape");

			const second = captureReasoningEffort(page);
			await chatInput.fill("Zweite Frage");
			await sendAndWaitForLLMResponse(page);
			expect(await second).toBe("medium");
		},
	);

	testWithMockedLlm(
		"is operated with ArrowLeft/Right and is a single Tab stop",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);

			// Opening focuses the first option; ArrowUp wraps to the selected radio.
			await page.keyboard.press("ArrowUp");
			await expect(radio(page, "Aus")).toBeFocused();

			await page.keyboard.press("ArrowRight");
			await expect(radio(page, "Niedrig")).toBeChecked();
			await expect(radio(page, "Niedrig")).toBeFocused();

			await page.keyboard.press("ArrowRight");
			await page.keyboard.press("ArrowRight");
			await expect(radio(page, "Hoch")).toBeFocused();

			await page.keyboard.press("ArrowLeft");
			await expect(radio(page, "Mittel")).toBeChecked();

			// Only the selected segment is tabbable.
			await expect(radio(page, "Mittel")).toHaveAttribute("tabindex", "0");
			await expect(radio(page, "Hoch")).toHaveAttribute("tabindex", "-1");

			// ArrowUp/Down still move between the dropdown rows.
			await page.keyboard.press("ArrowUp");
			await expect(page.getByRole("option").last()).toBeFocused();
			await page.keyboard.press("ArrowDown");
			await expect(radio(page, "Mittel")).toBeFocused();

			// Escape still closes the dropdown.
			await page.keyboard.press("Escape");
			await expect(reasoningGroup(page)).toBeHidden();
		},
	);
});
