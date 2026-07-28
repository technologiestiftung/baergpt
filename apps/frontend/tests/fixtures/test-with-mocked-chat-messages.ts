import { expect } from "@playwright/test";
import { testDesktopOnly } from "./test-desktop-only.ts";
import { supabaseAnonClient } from "../supabase.ts";
import type { Chat } from "../../src/common.ts";
import type { MockChatSearchHit } from "./mock-chat-search.ts";

export type ChatMessageInput = {
	role: "user" | "assistant";
	content: string;
	createdAt: Date;
};

export type InsertedMessage = {
	id: number;
	content: string;
};

type TestWithMockedChatMessages = {
	insertChat: (name: string, createdAt: Date) => Promise<number>;
	insertMessages: (
		chatId: number,
		messages: ChatMessageInput[],
	) => Promise<InsertedMessage[]>;
	buildMockedSearchFixtures: () => {
		chats: Chat[];
		messageHits: MockChatSearchHit[];
	};
};

/**
 * Extends `testDesktopOnly` with helpers for preparing chat search test data:
 * - `insertChat` / `insertMessages` seed real chats/messages via
 *   `supabaseAnonClient` for the current test user
 * - `buildMockedSearchFixtures` builds fabricated chats/message hits for
 *   `mockChatSearch`, for tests that only need to control the search
 *   dialog's states/keyboard behavior deterministically.
 */
export const testWithMockedChatMessages =
	testDesktopOnly.extend<TestWithMockedChatMessages>({
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

		buildMockedSearchFixtures: async ({ session }, use) => {
			await use(() => {
				const userId = session.user.id;
				const now = new Date().toISOString();

				const chats: Chat[] = [
					{
						id: 900_001,
						name: "Steuererklärung 2025",
						user_id: userId,
						created_at: now,
					},
					{
						id: 900_002,
						name: "Kita Anmeldung",
						user_id: userId,
						created_at: now,
					},
					{
						id: 900_003,
						name: "Führerschein Ummeldung",
						user_id: userId,
						created_at: now,
					},
				];

				const messageHits: MockChatSearchHit[] = [
					{
						id: 800_001,
						chat_id: 900_001,
						content: "Wie hoch ist die Grundsteuer in Berlin?",
						created_at: now,
					},
					{
						id: 800_002,
						chat_id: 900_002,
						content: "Wo melde ich mein Kind in Berlin für die Kita an?",
						created_at: now,
					},
					{
						id: 800_003,
						chat_id: 900_003,
						content:
							"Welche Behörde ist in Berlin für den Führerschein zuständig?",
						created_at: now,
					},
				];

				return { chats, messageHits };
			});
		},
	});
