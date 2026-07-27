import { supabase } from "../../../supabase-client.ts";
import type { Chat } from "../../common.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

const { handleError } = useErrorStore.getState();

export type ChatSearchResult = {
	chat: Chat;
	snippet: string;
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
 * Returns one result per chat (with the first matching message as snippet),
 * sorted by chat created_at descending.
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
		.select("chat_id, content, created_at")
		.ilike("content", pattern)
		.order("created_at", { ascending: true })
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (messageError) {
		handleError(messageError);
		return [];
	}

	const snippetByChatId = new Map<number, string>();
	for (const message of matchingMessages ?? []) {
		if (!snippetByChatId.has(message.chat_id)) {
			snippetByChatId.set(message.chat_id, message.content);
		}
	}

	const chatIds = [...snippetByChatId.keys()];
	if (chatIds.length === 0) {
		return [];
	}

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

	const results: ChatSearchResult[] = (chats ?? []).flatMap((chat) => {
		const snippet = snippetByChatId.get(chat.id);
		if (!snippet) {
			return [];
		}
		return [{ chat, snippet }];
	});

	results.sort(
		(a, b) =>
			new Date(b.chat.created_at).getTime() -
			new Date(a.chat.created_at).getTime(),
	);

	return results;
}
