import { supabase } from "../../../supabase-client.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

const { handleError } = useErrorStore.getState();

export const CHATS_PAGE_SIZE = 20;

/**
 * Uses `id` as a pagination cursor instead of counting rows (an offset)
 * or using `created_at`: an offset breaks if chats are added/removed
 * elsewhere (e.g. another tab) while scrolling, and `created_at` can be identical for
 * bulk-inserted rows. Both would silently skip chats on later pages.
 */
export async function getChats(cursor: number | null, signal: AbortSignal) {
	const { session } = useAuthStore.getState();

	if (!session?.user.id) {
		return [];
	}

	let query = supabase
		.from("chats")
		.select("*")
		.eq("user_id", session.user.id)
		.order("id", { ascending: false })
		.limit(CHATS_PAGE_SIZE);

	if (cursor !== null) {
		query = query.lt("id", cursor);
	}

	const { data, error } = await query.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		handleError(error);
		useErrorStore.getState().setUIError("chats-fetch", "chats_fetch_failed", {
			autoClean: false,
		});
		return [];
	}

	return data;
}
