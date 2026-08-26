import { Session } from "@supabase/supabase-js";
import { supabaseAnonClient } from "../supabase.ts";
import { expect } from "@playwright/test";
import { testDesktopOnly } from "./test-desktop-only.ts";

/**
 * We paginate chats in batches of 20, so having 30
 * chats ensures that we have multiple pages to load.
 */
const NUMBER_OF_TEST_CHATS = 30;

export const testDesktopOnlyWithManyChats = testDesktopOnly.extend({
	page: async ({ page, session }, use) => {
		/**
		 * This happens before each test that uses this fixture.
		 */
		await addChatsToAccount(session, NUMBER_OF_TEST_CHATS);

		/**
		 * This runs the test that uses this fixture (and injects the page).
		 */
		await use(page);
	},
});

async function addChatsToAccount(session: Session, numberOfChats: number) {
	// Inserted oldest-first so the assigned `id`s (used as the pagination
	// cursor) increase in the same order as `created_at`.
	const chats = Array.from({ length: numberOfChats }, (_, i) => ({
		user_id: session.user.id,
		name: `Test Chat ${i + 1}`,
		created_at: new Date(Date.now() - (numberOfChats - 1 - i)).toISOString(),
	}));

	const { error } = await supabaseAnonClient.from("chats").insert([...chats]);

	expect(error).toBeNull();
}
