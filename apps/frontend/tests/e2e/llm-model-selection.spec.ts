import { expect, type Page } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";

// Must match STORAGE_KEY in src/store/use-llm-model-store.ts.
const STORAGE_KEY = "llm-model";

const fastModelLabel = "Schnell";
const preciseModelLabel = "Präzise";
const fastModelOptionName = "Mistral Small 4 (schnell) auswählen";
const preciseModelOptionName = "Mistral Medium 3.5 (präzise) auswählen";

function openModelDropdown(page: Page, triggerLabel = fastModelLabel) {
	return page.getByRole("button", { name: triggerLabel, exact: false }).click();
}

/** Reads `llm_model` off the next completion request the page makes. */
function captureLlmModel(page: Page): Promise<string> {
	return page
		.waitForRequest("**/llm/just-chatting")
		.then((request) => request.postDataJSON().llm_model as string);
}

testWithMockedLlm.describe("LLM model selection", () => {
	testWithMockedLlm(
		"Change LLM model from fast to precise and back",
		async ({ page }) => {
			await page.goto("/");

			// Check that the fast LLM model is selected
			await expect(
				page.getByRole("button", { name: fastModelLabel, exact: false }),
			).toBeVisible();

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			await sendAndWaitForLLMResponse(page);

			const question1 = page
				.getByTestId("user-message-markdown-container")
				.first();
			await expect(question1).toBeVisible();

			const answer1 = page
				.getByTestId("assistant-message-markdown-container")
				.first();
			await expect(answer1).not.toBeEmpty();

			// Click on the LLM model button
			await openModelDropdown(page);

			// Select the precise LLM model
			await page.getByRole("option", { name: preciseModelOptionName }).click();

			// Verify that the precise LLM model is selected
			await expect(
				page.getByRole("button", { name: preciseModelLabel, exact: false }),
			).toBeVisible();

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			await sendAndWaitForLLMResponse(page);

			const question2 = page
				.getByTestId("user-message-markdown-container")
				.last();
			await expect(question2).toBeVisible();

			const answer2 = page
				.getByTestId("assistant-message-markdown-container")
				.last();
			await expect(answer2).not.toBeEmpty();

			// Click on the LLM model button
			await openModelDropdown(page, preciseModelLabel);

			// Verify that the model selection window is open
			await expect(page.getByText("Sprachmodell auswählen")).toBeVisible();

			// Select the fast LLM model
			await page.getByRole("option", { name: fastModelOptionName }).click();

			// Verify that the model selection window is closed after selecting a model
			await expect(page.getByText("Sprachmodell auswählen")).not.toBeVisible();

			// Verify that the fast LLM model is selected
			await expect(
				page.getByRole("button", { name: fastModelLabel, exact: false }),
			).toBeVisible();
		},
	);

	testWithMockedLlm(
		"persists the selected model across a reload",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);
			await page.getByRole("option", { name: preciseModelOptionName }).click();

			await expect(
				page.getByRole("button", { name: preciseModelLabel, exact: false }),
			).toBeVisible();

			await page.reload();

			await expect(
				page.getByRole("button", { name: preciseModelLabel, exact: false }),
			).toBeVisible();
		},
	);

	testWithMockedLlm(
		"sends the persisted model as llm_model with the next completion request",
		async ({ page }) => {
			await page.goto("/");
			await openModelDropdown(page);
			await page.getByRole("option", { name: preciseModelOptionName }).click();

			await page.reload();

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			const llmModel = captureLlmModel(page);
			await chatInput.fill("Eine Frage");
			await sendAndWaitForLLMResponse(page);

			expect(await llmModel).toBe("precise");
		},
	);

	testWithMockedLlm(
		"falls back to the fast model when the stored value is no longer available",
		async ({ page }) => {
			await page.addInitScript(
				({ storageKey, value }) => {
					window.localStorage.setItem(storageKey, value);
				},
				{
					storageKey: STORAGE_KEY,
					value: JSON.stringify({
						state: { selectedLlmModel: "mistral-small" },
						version: 0,
					}),
				},
			);

			await page.goto("/");

			await expect(
				page.getByRole("button", { name: fastModelLabel, exact: false }),
			).toBeVisible();
		},
	);
});
