import type { Page } from "@playwright/test";
import type { Chat } from "../../src/common.ts";

export type MockChatSearchHit = {
	id: number;
	chat_id: number;
	content: string;
	created_at: string;
};

/**
 * Mocks the two Supabase REST calls made by `searchChats` (see
 * `src/api/chat/search-chats.ts`), so the chat search dialog's states
 * ("results" / "no results" / loading) can be tested deterministically
 * without depending on real seeded data or Postgres ILIKE semantics.
 */
export async function mockChatSearch(
	page: Page,
	{
		messageHits,
		chats,
		delayMs = 0,
	}: {
		messageHits: MockChatSearchHit[];
		chats: Chat[];
		delayMs?: number;
	},
): Promise<void> {
	await page.route("**/rest/v1/chat_messages*", async (route) => {
		const contentFilter = new URL(route.request().url()).searchParams.get(
			"content",
		);
		if (!contentFilter?.startsWith("ilike.")) {
			return route.fallback();
		}

		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		return route.fulfill({ json: messageHits });
	});

	await page.route("**/rest/v1/chats*", async (route) => {
		if (route.request().method() !== "GET") {
			return route.fallback();
		}

		const idFilter = new URL(route.request().url()).searchParams.get("id");
		if (!idFilter?.startsWith("in.")) {
			return route.fallback();
		}

		return route.fulfill({ json: chats });
	});
}
