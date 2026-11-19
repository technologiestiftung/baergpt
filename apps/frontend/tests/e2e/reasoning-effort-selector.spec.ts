import { expect, type Page } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";

const fastModelLabel = "Schnell";
const preciseModelOptionName = "Mistral Large 4 (ausgewogen) auswählen";

function openModelDropdown(page: Page, triggerLabel = fastModelLabel) {
	return page.getByRole("button", { name: triggerLabel, exact: false }).click();
}

function slider(page: Page) {
	return page.getByRole("slider", { name: "Denkaufwand" });
}

/** Clicks the step with the given label on the slider. */
function selectStep(page: Page, name: string) {
	return slider(page).getByText(name, { exact: true }).click();
}

function expectLevel(page: Page, name: string) {
	return expect(slider(page)).toHaveAttribute("aria-valuetext", name);
}

/** Reads `reasoning_effort` off the next completion request the page makes. */
function captureReasoningEffort(page: Page): Promise<string> {
	return page
		.waitForRequest("**/llm/just-chatting")
		.then((request) => request.postDataJSON().reasoning_effort as string);
}

testWithMockedLlm.describe("Reasoning effort slider", () => {
	testWithMockedLlm(
		"is a slider with four steps and defaults to Niedrig",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page, "Schnell · Niedrig");

			await expect(slider(page)).toBeVisible();
			await expect(slider(page)).toHaveAttribute("aria-valuemin", "0");
			await expect(slider(page)).toHaveAttribute("aria-valuemax", "3");
			await expectLevel(page, "Niedrig");
			await expect(
				page.getByText("Kurzes Überlegen für einfache Aufgaben."),
			).toBeVisible();

			await selectStep(page, "Mittel");
			await expectLevel(page, "Mittel");
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
			await selectStep(page, "Hoch");
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
			await selectStep(page, "Mittel");

			// Picking a model closes the dropdown, so reopen it.
			await page.getByRole("option", { name: preciseModelOptionName }).click();
			await openModelDropdown(page, "Ausgewogen");
			await expectLevel(page, "Mittel");

			await page.reload();
			await openModelDropdown(page, "Ausgewogen");
			await expectLevel(page, "Mittel");
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

			await expectLevel(page, "Hoch");
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
			expect(await first).toBe("low");

			await openModelDropdown(page);
			await selectStep(page, "Mittel");
			await page.keyboard.press("Escape");

			const second = captureReasoningEffort(page);
			await chatInput.fill("Zweite Frage");
			await sendAndWaitForLLMResponse(page);
			expect(await second).toBe("medium");
		},
	);

	testWithMockedLlm(
		"is operated with the arrow keys and is a single Tab stop",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);

			// Opening focuses the first option; ArrowUp wraps to the slider.
			await page.keyboard.press("ArrowUp");
			await expect(slider(page)).toBeFocused();

			await page.keyboard.press("ArrowRight");
			await expectLevel(page, "Mittel");
			await expect(slider(page)).toBeFocused();

			await page.keyboard.press("ArrowRight");
			await expectLevel(page, "Hoch");

			await page.keyboard.press("ArrowLeft");
			await expectLevel(page, "Mittel");

			await page.keyboard.press("Home");
			await expectLevel(page, "Aus");
			await page.keyboard.press("End");
			await expectLevel(page, "Hoch");

			// Exactly one slider, and it is the only tabbable part of the control.
			await expect(page.getByRole("slider")).toHaveCount(1);
			await expect(slider(page)).toHaveAttribute("tabindex", "0");

			// ArrowUp/Down still move between the dropdown rows.
			await page.keyboard.press("ArrowUp");
			await expect(page.getByRole("option").last()).toBeFocused();
			await page.keyboard.press("ArrowDown");
			await expect(slider(page)).toBeFocused();

			// Escape still closes the dropdown.
			await page.keyboard.press("Escape");
			await expect(slider(page)).toBeHidden();
		},
	);
});
