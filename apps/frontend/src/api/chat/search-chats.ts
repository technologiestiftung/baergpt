import { supabase } from "../../../supabase-client.ts";
import type { Chat } from "../../common.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

const { handleError } = useErrorStore.getState();

const SEARCH_RESULT_LIMIT = 50;

export type ChatSearchResult = {
	chat: Chat;
	messageId: number;
	snippet: string;
	createdAt: string;
};

/**
 * Escapes characters that have special meaning in Postgres LIKE/ILIKE patterns
 * and commas used by PostgREST filter parsing.
 */
function escapeIlikeQuery(query: string): string {
	return query
		.replace(/\\/g, "\\\\")
		.replace(/%/g, "\\%")
		.replace(/_/g, "\\_")
		.replace(/,/g, "\\,");
}

/**
 * Searches the current user's chats by message content.
 * Returns one result per matching message, sorted by message created_at
 * descending, capped at SEARCH_RESULT_LIMIT.
 */
export async function searchChats(
	query: string,
	signal: AbortSignal,
): Promise<ChatSearchResult[]> {
	const { session } = useAuthStore.getState();

	if (!session?.user.id) {
		return [];
	}

	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return [];
	}

	const pattern = `%${escapeIlikeQuery(trimmedQuery)}%`;

	const { data: matchingMessages, error: messageError } = await supabase
		.from("chat_messages")
		.select("id, chat_id, content, created_at")
		.ilike("content", pattern)
		.order("created_at", { ascending: false })
		.limit(SEARCH_RESULT_LIMIT)
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (messageError) {
		handleError(messageError);
		return [];
	}

	const messages = matchingMessages ?? [];
	if (messages.length === 0) {
		return [];
	}

	const chatIds = [...new Set(messages.map((message) => message.chat_id))];

	const { data: chats, error: chatsError } = await supabase
		.from("chats")
		.select("*")
		.eq("user_id", session.user.id)
		.in("id", chatIds)
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (chatsError) {
		handleError(chatsError);
		return [];
	}

	const chatById = new Map((chats ?? []).map((chat) => [chat.id, chat]));

	return messages.flatMap((message) => {
		const chat = chatById.get(message.chat_id);
		if (!chat) {
			return [];
		}
		return [
			{
				chat,
				messageId: message.id,
				snippet: message.content,
				createdAt: message.created_at,
			},
		];
	});
}
