import { supabase } from "../../../supabase-client.ts";
import type { Chat } from "../../common.ts";
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
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return [];
	}

	const pattern = `%${escapeIlikeQuery(trimmedQuery)}%`;

	const { data, error } = await supabase
		.rpc("search_chat_messages", {
			search_pattern: pattern,
			result_limit: SEARCH_RESULT_LIMIT,
		})
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		handleError(error);
		return [];
	}

	return data.map((row) => ({
		chat: {
			id: row.chat_id,
			name: row.chat_name,
			user_id: row.chat_user_id,
			created_at: row.chat_created_at,
		},
		messageId: row.message_id,
		snippet: row.message_content,
		createdAt: row.message_created_at,
	}));
}
