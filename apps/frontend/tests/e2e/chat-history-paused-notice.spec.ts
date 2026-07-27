import { expect, test } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { testDesktopOnly } from "../fixtures/test-desktop-only.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";
import { defaultDocumentName } from "../constants.ts";

test.describe("Chat history paused notice", () => {
	testWithMockedLlm(
		"shows the info message when web search is activated in a chat with a prior message",
		async ({ page, isMobile }) => {
			testWithMockedLlm.skip(isMobile === true, "desktop-only menu flow");

			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testWithMockedLlm.skip();
			}

			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("Hallo, wie geht es dir?");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).toBeVisible();
		},
	);

	testWithMockedLlm(
		"does not show the info message when web search is activated in a fresh chat",
		async ({ page, isMobile }) => {
			testWithMockedLlm.skip(isMobile === true, "desktop-only menu flow");

			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testWithMockedLlm.skip();
			}

			await page.goto("/");

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const chatInput = page.getByPlaceholder("Das Web durchsuchen");
			await expect(chatInput).toBeVisible();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).not.toBeVisible();
		},
	);

	testWithMockedLlm(
		"clears the info message when the tool is manually deactivated",
		async ({ page, isMobile }) => {
			testWithMockedLlm.skip(isMobile === true, "desktop-only menu flow");

			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testWithMockedLlm.skip();
			}

			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("Hallo, wie geht es dir?");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).toBeVisible();

			const webSearchPill = page.getByRole("button", {
				name: "Websuche entfernen",
			});
			await webSearchPill.click();

			await expect(historyScopedInfoMessage).not.toBeVisible();
		},
	);

	testDesktopOnly(
		"replaces the info message with the auto-deactivation info message when a document is added",
		async ({ page }) => {
			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testDesktopOnly.skip();
			}

			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("Hallo, wie geht es dir?");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).toBeVisible();

			const addDocumentToChatButton = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("In den Chat");
			await addDocumentToChatButton.click();

			const toolDeactivatedInfoMessage = page.getByText(
				"Websuche wurde automatisch deaktiviert.",
			);
			await expect(toolDeactivatedInfoMessage).toBeVisible();
			await expect(historyScopedInfoMessage).not.toBeVisible();
		},
	);
});
