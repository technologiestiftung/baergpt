import { supabase } from "../../../supabase-client.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

const { handleError } = useErrorStore.getState();

export async function getTotalChatCount(signal: AbortSignal) {
	const { session } = useAuthStore.getState();

	if (!session?.user.id) {
		return null;
	}

	const { count, error } = await supabase
		.from("chats")
		.select("*", { count: "exact", head: true })
		.abortSignal(signal);

	if (signal.aborted) {
		return null;
	}

	if (error) {
		handleError(error);
		useErrorStore.getState().setUIError("chats-fetch", "chats_fetch_failed", {
			autoClean: false,
		});
		return null;
	}

	return count;
}
