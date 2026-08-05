import { expect, test } from "@playwright/test";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
import { sendAndWaitForLLMResponse } from "../fixtures/mock-llm.ts";
import { supabaseAdminClient } from "../supabase.ts";

type MessageExternalToolContext = {
	role: string;
	external_tool_context: boolean;
};

async function getMessageExternalToolContextFlags(
	userId: string,
): Promise<MessageExternalToolContext[]> {
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
		.select("role, external_tool_context")
		.eq("chat_id", chatId)
		.order("id", { ascending: true });

	if (messagesError) {
		throw messagesError;
	}

	return messages ?? [];
}

test.describe("External tool context tagging", () => {
	testWithMockedLlm(
		"tags user and assistant rows as external tool context when web search is toggled on",
		async ({ page, account, isMobile }) => {
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
			await chatInput.fill("Suche nach aktuellen Terminen");

			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			await expect
				.poll(() => getMessageExternalToolContextFlags(account.id))
				.toEqual([
					{ role: "user", external_tool_context: true },
					{ role: "assistant", external_tool_context: true },
				]);
		},
	);

	testWithMockedLlm(
		"tags user and assistant rows as false for a normal turn without an external tool",
		async ({ page, account }) => {
			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("Hallo, wie geht es dir?");

			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			await expect
				.poll(() => getMessageExternalToolContextFlags(account.id))
				.toEqual([
					{ role: "user", external_tool_context: false },
					{ role: "assistant", external_tool_context: false },
				]);
		},
	);
});
