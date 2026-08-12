import { expect, test, type Page } from "@playwright/test";
import { testWithChatSearch } from "../fixtures/test-with-chat-search.ts";

function getChatRow(page: Page, chatName: string) {
	return page
		.getByRole("button", { name: chatName, exact: true })
		.locator("..");
}

test.describe("Chat history rename", () => {
	testWithChatSearch(
		"renames a chat via the history entry dropdown menu",
		async ({ page, insertChat }) => {
			const originalName = "Ursprünglicher Chatname";
			const newName = "Neuer Chatname";
			await insertChat(originalName, new Date());

			await page.goto("/");

			const chatRow = getChatRow(page, originalName);
			await chatRow.hover();
			await chatRow.getByRole("button", { name: "Chat-Optionen" }).click();

			await page.getByRole("option", { name: "Umbenennen" }).click();

			const renameInput = page.getByRole("textbox", {
				name: "Chat umbenennen",
			});
			await expect(renameInput).toBeVisible();
			await expect(renameInput).toHaveValue(originalName);

			await renameInput.fill(newName);
			await renameInput.press("Enter");

			await expect(
				page.getByRole("button", { name: newName, exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: originalName, exact: true }),
			).toHaveCount(0);
		},
	);

	testWithChatSearch(
		"reverts to the previous name when the new name is empty",
		async ({ page, insertChat }) => {
			const originalName = "Chat mit festem Namen";
			await insertChat(originalName, new Date());

			await page.goto("/");

			const chatRow = getChatRow(page, originalName);
			await chatRow.hover();
			await chatRow.getByRole("button", { name: "Chat-Optionen" }).click();
			await page.getByRole("option", { name: "Umbenennen" }).click();

			const renameInput = page.getByRole("textbox", {
				name: "Chat umbenennen",
			});
			await renameInput.fill("   ");
			await renameInput.press("Enter");

			await expect(
				page.getByRole("button", { name: originalName, exact: true }),
			).toBeVisible();
		},
	);

	testWithChatSearch(
		"closes the menu on Escape and on outside click without side effects",
		async ({ page, insertChat }) => {
			const chatName = "Chat für Menü-Test";
			await insertChat(chatName, new Date());

			await page.goto("/");

			const chatRow = getChatRow(page, chatName);
			await chatRow.hover();
			const menuButton = chatRow.getByRole("button", { name: "Chat-Optionen" });

			await menuButton.click();
			await expect(page.getByRole("listbox")).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(page.getByRole("listbox")).not.toBeVisible();

			await chatRow.hover();
			await menuButton.click();
			await expect(page.getByRole("listbox")).toBeVisible();
			await page.mouse.click(10, 10);
			await expect(page.getByRole("listbox")).not.toBeVisible();

			await expect(
				page.getByRole("button", { name: chatName, exact: true }),
			).toBeVisible();
		},
	);
});
