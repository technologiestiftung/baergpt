import { supabase } from "../../../supabase-client.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

const { handleError } = useErrorStore.getState();

/**
 * We query chats with a range, where the start and end are inclusive.
 * Therefore, to get 20 items, we need to set the end to start + 19.
 * e.g. offset = 0 -> range(0, 19) --> 20 items
 */
const RANGE_LIMIT = 19;

export async function getChats(offset: number, signal: AbortSignal) {
	const { session } = useAuthStore.getState();

	if (!session?.user.id) {
		return [];
	}

	const { data, error } = await supabase
		.from("chats")
		.select("*")
		.eq("user_id", session.user.id)
		.order("created_at", { ascending: false })
		.range(offset, offset + RANGE_LIMIT)
		.abortSignal(signal);

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
