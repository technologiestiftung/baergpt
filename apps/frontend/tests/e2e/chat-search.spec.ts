import { expect, test, type Page } from "@playwright/test";
import {
	CHATS_PAGE_SIZE,
	insertFillerChats,
	seedBerlinSearchChats,
	testWithChatSearch,
} from "../fixtures/test-with-chat-search.ts";

async function openChatSearchDialog(page: Page) {
	await page.getByRole("button", { name: "Chatsuche öffnen" }).click();
	return page.getByRole("combobox", { name: "Chats durchsuchen..." });
}

test.describe("Chat search", () => {
	testWithChatSearch(
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

	testWithChatSearch(
		"shows matching results with highlighted snippets for a search query",
		async ({ page, insertChat, insertMessages }) => {
			await seedBerlinSearchChats(insertChat, insertMessages);

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

	testWithChatSearch(
		"shows a loading skeleton while a search is in flight",
		async ({ page, insertChat, insertMessages }) => {
			await seedBerlinSearchChats(insertChat, insertMessages);

			// Slow down the Supabase search request so the skeleton is observable.
			await page.route("**/rest/v1/rpc/search_chat_messages", async (route) => {
				if (route.request().method() !== "POST") {
					return route.fallback();
				}

				await new Promise((resolve) => setTimeout(resolve, 800));
				return route.continue();
			});

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

	testWithChatSearch(
		"shows an empty state when no chats match the query",
		async ({ page }) => {
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
			await expect(page.getByRole("dialog")).toBeVisible();
		},
	);

	testWithChatSearch(
		"exposes correct combobox ARIA attributes for the active result",
		async ({ page, insertChat, insertMessages }) => {
			await seedBerlinSearchChats(insertChat, insertMessages);

			await page.goto("/");

			const searchInput = await openChatSearchDialog(page);
			await expect(searchInput).toHaveAttribute("aria-expanded", "true");

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

	testWithChatSearch(
		"navigates results with the arrow keys and clamps at the boundaries",
		async ({ page, insertChat, insertMessages }) => {
			await seedBerlinSearchChats(insertChat, insertMessages);

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

	testWithChatSearch(
		"closes the dialog and resets the query on Escape",
		async ({ page, insertChat, insertMessages }) => {
			await seedBerlinSearchChats(insertChat, insertMessages);

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

	testWithChatSearch(
		"opens the currently selected result on Enter",
		async ({ page, insertChat, insertMessages }) => {
			await seedBerlinSearchChats(insertChat, insertMessages);

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

	testWithChatSearch(
		"fetches and opens a search result that is not in the currently loaded chats",
		async ({ page, insertChat, insertMessages, session }) => {
			const now = Date.now();

			await insertFillerChats(session, CHATS_PAGE_SIZE, new Date(now));

			const unloadedChatName = "Archivierter Berlin-Chat";
			const unloadedMessage = "Wie hoch ist die Grundsteuer in Berlin?";
			const unloadedChatId = await insertChat(
				unloadedChatName,
				new Date(now - CHATS_PAGE_SIZE * 1_000 - 60_000),
			);
			await insertMessages(unloadedChatId, [
				{
					role: "user",
					content: unloadedMessage,
					createdAt: new Date(now - CHATS_PAGE_SIZE * 1_000 - 60_000),
				},
			]);

			// Keep the second history page from loading so the older chat stays
			// out of the chats store (intersection observer would otherwise fetch it).
			await page.route(
				(url) =>
					url.pathname.includes("/rest/v1/chats") &&
					url.searchParams.get("offset") === String(CHATS_PAGE_SIZE),
				async () => {
					await new Promise(() => {});
				},
			);

			await page.goto("/");

			const sidebar = page.getByRole("complementary", { name: "Sidebar" });
			await expect(
				sidebar.getByRole("button", { name: "Filler Chat 0", exact: true }),
			).toBeVisible();
			await expect(
				sidebar.getByRole("button", {
					name: unloadedChatName,
					exact: true,
				}),
			).toHaveCount(0);

			const searchInput = await openChatSearchDialog(page);
			await searchInput.fill("Berlin");

			const options = page.getByRole("option");
			await expect(options).toHaveCount(1);
			await expect(options.first()).toContainText(unloadedChatName);

			const messagesFetch = page.waitForRequest((request) => {
				const url = new URL(request.url());
				return (
					url.pathname.includes("/rest/v1/chat_messages") &&
					url.searchParams.get("chat_id") === `eq.${unloadedChatId}`
				);
			});

			await searchInput.press("Enter");
			await messagesFetch;

			await expect(page.getByRole("dialog")).toBeHidden();

			const userMessage = page.getByTestId("user-message-markdown-container");
			await expect(userMessage).toContainText(unloadedMessage);
		},
	);
});
