import { expect } from "@playwright/test";
import type { Session } from "@supabase/supabase-js";
import { testDesktopOnly } from "./test-desktop-only.ts";
import { supabaseAnonClient } from "../supabase.ts";

/** Matches `RANGE_LIMIT + 1` in `src/api/chat/get-chats.ts`. */
export const CHATS_PAGE_SIZE = 20;

export type ChatMessageInput = {
	role: "user" | "assistant";
	content: string;
	createdAt: Date;
};

export type InsertedMessage = {
	id: number;
	content: string;
};

type TestWithChatSearch = {
	insertChat: (name: string, createdAt: Date) => Promise<number>;
	insertMessages: (
		chatId: number,
		messages: ChatMessageInput[],
	) => Promise<InsertedMessage[]>;
};

/**
 * Extends `testDesktopOnly` with helpers that seed chats/messages via
 * `supabaseAnonClient` for the current test user.
 */
export const testWithChatSearch = testDesktopOnly.extend<TestWithChatSearch>({
	insertChat: async ({ session }, use) => {
		await use(async (name, createdAt) => {
			const { data, error } = await supabaseAnonClient
				.from("chats")
				.insert({
					user_id: session.user.id,
					name,
					created_at: createdAt.toISOString(),
				})
				.select("id")
				.single();

			expect(error, error?.message).toBeNull();

			if (!data) {
				throw new Error("Failed to insert test chat");
			}

			return data.id;
		});
	},

	insertMessages: async ({}, use) => {
		await use(async (chatId, messages) => {
			const { data, error } = await supabaseAnonClient
				.from("chat_messages")
				.insert(
					messages.map(({ role, content, createdAt }) => ({
						chat_id: chatId,
						role,
						type: "text",
						content,
						created_at: createdAt.toISOString(),
					})),
				)
				.select("id, content");

			expect(error, error?.message).toBeNull();

			return data ?? [];
		});
	},
});

/** Seeds three chats whose messages all contain "Berlin", newest first. */
export async function seedBerlinSearchChats(
	insertChat: TestWithChatSearch["insertChat"],
	insertMessages: TestWithChatSearch["insertMessages"],
): Promise<void> {
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
			content: "Welche Behörde ist in Berlin für den Führerschein zuständig?",
			createdAt: new Date(now - 2_000),
		},
	]);
}

/**
 * Inserts newer filler chats so a later, older chat falls outside the first
 * page. Inserted oldest-first so the assigned `id`s (used as the pagination
 * cursor) increase in the same order as `created_at`.
 */
export async function insertFillerChats(
	session: Session,
	count: number,
	newestCreatedAt: Date,
): Promise<void> {
	const chats = Array.from({ length: count }, (_, i) => {
		const chatIndex = count - 1 - i;
		return {
			user_id: session.user.id,
			name: `Filler Chat ${chatIndex}`,
			created_at: new Date(
				newestCreatedAt.getTime() - chatIndex * 1_000,
			).toISOString(),
		};
	});

	const { error } = await supabaseAnonClient.from("chats").insert(chats);

	expect(error, error?.message).toBeNull();
}
