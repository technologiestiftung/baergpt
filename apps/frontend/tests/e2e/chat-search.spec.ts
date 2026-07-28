import { expect, test, type Page } from "@playwright/test";
import { testWithMockedChatMessages } from "../fixtures/test-with-mocked-chat-messages.ts";
import { mockChatSearch } from "../fixtures/mock-chat-search.ts";

async function openChatSearchDialog(page: Page) {
	await page.getByRole("button", { name: "Chatsuche öffnen" }).click();
	return page.getByRole("combobox", { name: "Chats durchsuchen..." });
}

test.describe("Chat search", () => {
	testWithMockedChatMessages(
		"shows the most recently used chats when no search query is entered",
		async ({ page, insertChat }) => {
			await insertChat("Älterer Testchat", new Date(Date.now() - 60_000));
			await insertChat("Neuerer Testchat", new Date());

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await expect(searchInput).toBeFocused();

			await expect(page.getByText("Letzte Chats")).toBeVisible();
			await expect(page.getByRole("listbox")).toBeVisible();

			const lastChats = page.getByRole("option", {
				name: /Testchat/,
			});
			await expect(lastChats).toHaveCount(2);
			await expect(lastChats.nth(0)).toContainText("Neuerer Testchat");
			await expect(lastChats.nth(1)).toContainText("Älterer Testchat");
			await expect(lastChats.nth(0)).toHaveAttribute("aria-selected", "true");
		},
	);

	testWithMockedChatMessages(
		"shows matching results with highlighted snippets for a search query",
		async ({ page, buildMockedSearchFixtures }) => {
			const { chats, messageHits } = buildMockedSearchFixtures();
			await mockChatSearch(page, { chats, messageHits });

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await searchInput.fill("Berlin");

			await expect(page.getByText("Ergebnisse")).toBeVisible();
			const options = page.getByRole("option");
			await expect(options).toHaveCount(3);

			await expect(options.nth(0)).toContainText("Steuererklärung 2025");
			await expect(options.nth(1)).toContainText("Kita Anmeldung");
			await expect(options.nth(2)).toContainText("Führerschein Ummeldung");

			for (const option of await options.all()) {
				await expect(
					option.locator("span.text-xs.leading-4 span.font-semibold"),
				).toHaveText("Berlin");
			}
		},
	);

	testWithMockedChatMessages(
		"shows a loading skeleton while a search is in flight",
		async ({ page, buildMockedSearchFixtures }) => {
			const { chats, messageHits } = buildMockedSearchFixtures();
			await mockChatSearch(page, { chats, messageHits, delayMs: 800 });

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await searchInput.fill("Berlin");

			const skeleton = page.locator('[aria-busy="true"]');
			await expect(skeleton).toBeVisible();
			await expect(page.getByRole("listbox")).toHaveCount(0);

			await expect(page.getByRole("listbox")).toBeVisible();
			await expect(skeleton).not.toBeVisible();
		},
	);

	testWithMockedChatMessages(
		"shows an empty state when no chats match the query",
		async ({ page, buildMockedSearchFixtures }) => {
			const { chats } = buildMockedSearchFixtures();
			await mockChatSearch(page, { chats, messageHits: [] });

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await searchInput.fill("Unbekannter Suchbegriff Xyz");

			await expect(
				page.getByText("„Unbekannter Suchbegriff Xyz“"),
			).toBeVisible();
			await expect(
				page.getByText(
					"Bitte überprüfen Sie Ihre Schreibweise oder versuchen Sie einen anderen Suchbegriff.",
				),
			).toBeVisible();
			await expect(page.getByRole("listbox")).toHaveCount(0);

			await expect(
				page.getByText("„Unbekannter Suchbegriff Xyz“"),
			).toBeVisible();
			await expect(page.getByRole("dialog")).toBeVisible();
		},
	);

	testWithMockedChatMessages(
		"exposes correct combobox ARIA attributes for the active result",
		async ({ page, buildMockedSearchFixtures }) => {
			const { chats, messageHits } = buildMockedSearchFixtures();
			await mockChatSearch(page, { chats, messageHits });

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await expect(searchInput).toHaveAttribute("aria-expanded", "false");

			await searchInput.fill("Berlin");

			const listbox = page.getByRole("listbox");
			await expect(listbox).toBeVisible();
			const listboxId = await listbox.getAttribute("id");

			await expect(searchInput).toHaveAttribute("aria-expanded", "true");
			await expect(searchInput).toHaveAttribute(
				"aria-controls",
				listboxId ?? "",
			);

			const firstOption = page.getByRole("option").first();
			const firstOptionId = await firstOption.getAttribute("id");
			await expect(searchInput).toHaveAttribute(
				"aria-activedescendant",
				firstOptionId ?? "",
			);
			await expect(firstOption).toHaveAttribute("aria-selected", "true");
		},
	);

	testWithMockedChatMessages(
		"navigates results with the arrow keys and clamps at the boundaries",
		async ({ page, buildMockedSearchFixtures }) => {
			const { chats, messageHits } = buildMockedSearchFixtures();
			await mockChatSearch(page, { chats, messageHits });

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await searchInput.fill("Berlin");

			const options = page.getByRole("option");
			await expect(options).toHaveCount(3);

			await test.step("ArrowUp on the first item stays on the first item", async () => {
				await searchInput.press("ArrowUp");
				await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
			});

			await test.step("ArrowDown moves selection forward", async () => {
				await searchInput.press("ArrowDown");
				await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
				await expect(options.nth(0)).toHaveAttribute("aria-selected", "false");

				await searchInput.press("ArrowDown");
				await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
			});

			await test.step("ArrowDown on the last item stays on the last item", async () => {
				await searchInput.press("ArrowDown");
				await expect(options.nth(2)).toHaveAttribute("aria-selected", "true");
			});

			await test.step("ArrowUp moves selection backward", async () => {
				await searchInput.press("ArrowUp");
				await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
			});
		},
	);

	testWithMockedChatMessages(
		"closes the dialog and resets the query on Escape",
		async ({ page, buildMockedSearchFixtures }) => {
			const { chats, messageHits } = buildMockedSearchFixtures();
			await mockChatSearch(page, { chats, messageHits });

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await searchInput.fill("Berlin");
			await expect(page.getByRole("listbox")).toBeVisible();

			await searchInput.press("Escape");
			await expect(page.getByRole("dialog")).toBeHidden();

			// Reopening shows the default state again, proving the query/results
			// were reset by the dialog's `afterClose` handler.
			const reopenedSearchInput = await openChatSearchDialog(page);
			await expect(reopenedSearchInput).toHaveValue("");
			await expect(page.getByText("Letzte Chats")).toBeVisible();
		},
	);

	testWithMockedChatMessages(
		"opens the currently selected result on Enter",
		async ({ page, insertChat, insertMessages }) => {
			const now = Date.now();

			const chatA = await insertChat("Steuererklärung 2025", new Date(now));
			await insertMessages(chatA, [
				{
					role: "user",
					content: "Wie hoch ist die Grundsteuer in Berlin?",
					createdAt: new Date(now),
				},
			]);

			const chatB = await insertChat("Kita Anmeldung", new Date(now - 1_000));
			await insertMessages(chatB, [
				{
					role: "user",
					content: "Wo melde ich mein Kind in Berlin für die Kita an?",
					createdAt: new Date(now - 1_000),
				},
			]);

			const chatC = await insertChat(
				"Führerschein Ummeldung",
				new Date(now - 2_000),
			);
			await insertMessages(chatC, [
				{
					role: "user",
					content:
						"Welche Behörde ist in Berlin für den Führerschein zuständig?",
					createdAt: new Date(now - 2_000),
				},
			]);

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await searchInput.fill("Berlin");

			const options = page.getByRole("option");
			await expect(options).toHaveCount(3);
			await expect(options.nth(0)).toContainText("Steuererklärung 2025");
			await expect(options.nth(1)).toContainText("Kita Anmeldung");

			// Move selection to the second result before confirming.
			await searchInput.press("ArrowDown");
			await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
			await searchInput.press("Enter");

			await expect(page.getByRole("dialog")).toBeHidden();

			// The second chat's message should now be the one shown.
			const userMessage = page.getByTestId("user-message-markdown-container");
			await expect(userMessage).toContainText(
				"Wo melde ich mein Kind in Berlin für die Kita an?",
			);
		},
	);
});
