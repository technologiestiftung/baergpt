import { expect, type Page } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";

const fastModelLabel = "Schnell";
const preciseModelLabel = "Präzise";
const preciseModelOptionName = "Mistral Medium 3.5 (präzise) auswählen";
const extendedThinkingSwitchName = "Länger nachdenken auswählen";

function extendedThinkingSwitch(page: Page) {
	return page.getByRole("switch", { name: extendedThinkingSwitchName });
}

function clickExtendedThinkingSwitch(page: Page) {
	return page
		.locator("label")
		.filter({ has: extendedThinkingSwitch(page) })
		.click();
}

function openModelDropdown(page: Page, triggerLabel = fastModelLabel) {
	return page.getByRole("button", { name: triggerLabel, exact: false }).click();
}

/** True while the focused element is one of the dropdown's own controls. */
function isFocusInsideDropdown(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const active = document.activeElement;
		return (
			active instanceof HTMLElement &&
			active.matches('[role="option"], [role="switch"]')
		);
	});
}

/** Reads `extended_thinking` off the next completion request the page makes. */
function captureExtendedThinkingFlag(page: Page): Promise<boolean> {
	return page
		.waitForRequest("**/llm/just-chatting")
		.then((request) => request.postDataJSON().extended_thinking as boolean);
}

testWithMockedLlm.describe("Extended thinking toggle", () => {
	testWithMockedLlm(
		"is off by default and exposes its state as a switch",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);

			const toggle = extendedThinkingSwitch(page);
			await expect(toggle).toBeVisible();
			await expect(toggle).not.toBeChecked();

			await clickExtendedThinkingSwitch(page);
			await expect(toggle).toBeChecked();
		},
	);

	testWithMockedLlm(
		"survives selecting a different model",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);
			await clickExtendedThinkingSwitch(page);

			// Picking a model closes the dropdown, so reopen it.
			await page.getByRole("option", { name: preciseModelOptionName }).click();
			await openModelDropdown(page, preciseModelLabel);

			await expect(extendedThinkingSwitch(page)).toBeChecked();
		},
	);

	testWithMockedLlm("persists across a page reload", async ({ page }) => {
		await page.goto("/");
		await openModelDropdown(page);
		await clickExtendedThinkingSwitch(page);

		await page.reload();
		await openModelDropdown(page);

		await expect(extendedThinkingSwitch(page)).toBeChecked();
	});

	testWithMockedLlm(
		"sends the flag with the next message and not before",
		async ({ page }) => {
			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");

			// Off: the first turn must not request extended thinking.
			const firstFlag = captureExtendedThinkingFlag(page);
			await chatInput.fill("Erste Frage");
			await sendAndWaitForLLMResponse(page);
			expect(await firstFlag).toBe(false);

			// On: only the following turn carries the flag.
			await openModelDropdown(page);
			await clickExtendedThinkingSwitch(page);
			await page.keyboard.press("Escape");

			const secondFlag = captureExtendedThinkingFlag(page);
			await chatInput.fill("Zweite Frage");
			await sendAndWaitForLLMResponse(page);
			expect(await secondFlag).toBe(true);
		},
	);

	testWithMockedLlm(
		"is reachable by keyboard and Escape still closes the dropdown",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);

			const toggle = extendedThinkingSwitch(page);

			// Opening focuses the first option; ArrowUp wraps to the switch.
			await page.keyboard.press("ArrowUp");
			await expect(toggle).toBeFocused();

			await page.keyboard.press("Space");
			await expect(toggle).toBeChecked();

			await page.keyboard.press("Enter");
			await expect(toggle).not.toBeChecked();

			await page.keyboard.press("Escape");
			await expect(toggle).toBeHidden();
		},
	);

	testWithMockedLlm(
		"is reachable by Tab, which does not close the dropdown",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);

			const options = page.getByRole("option");
			const optionCount = await options.count();
			const toggle = extendedThinkingSwitch(page);

			// Tab walks the remaining options, then reaches the switch.
			for (let i = 1; i < optionCount; i++) {
				await page.keyboard.press("Tab");
				await expect(options.nth(i)).toBeFocused();
			}

			await page.keyboard.press("Tab");
			await expect(toggle).toBeFocused();
			await expect(toggle).toBeVisible();

			// The switch is the last stop: rather than trapping focus, Tab leaves
			// the dropdown forwards and Shift+Tab from the first option leaves it
			// backwards. Where focus lands outside is up to the browser; what
			// matters is that it leaves and the dropdown stays open.
			await page.keyboard.press("Tab");
			await expect(isFocusInsideDropdown(page)).resolves.toBe(false);
			await expect(toggle).toBeVisible();

			await options.first().focus();
			await page.keyboard.press("Shift+Tab");
			await expect(isFocusInsideDropdown(page)).resolves.toBe(false);
			await expect(toggle).toBeVisible();
		},
	);

	testWithMockedLlm(
		"persists the toggle but not the model across a reload",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);
			await clickExtendedThinkingSwitch(page);
			await page.getByRole("option", { name: preciseModelOptionName }).click();

			await expect(
				page.getByRole("button", { name: preciseModelLabel, exact: false }),
			).toBeVisible();

			await page.reload();

			// Only the toggle is stored, so no stale model id can be sent.
			await expect(
				page.getByRole("button", { name: fastModelLabel, exact: false }),
			).toBeVisible();
			await openModelDropdown(page);
			await expect(extendedThinkingSwitch(page)).toBeChecked();
		},
	);
});
