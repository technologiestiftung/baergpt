import { supabase } from "../../../supabase-client.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

const { handleError } = useErrorStore.getState();

export async function getChats(signal: AbortSignal) {
	const { session } = useAuthStore.getState();

	if (!session?.user.id) {
		return [];
	}

	const { data, error } = await supabase
		.from("chats")
		.select("*")
		.eq("user_id", session.user.id)
		.order("created_at", { ascending: false })
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		handleError(error);
		return [];
	}

	return data;
}
