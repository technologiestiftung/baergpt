import { supabase } from "../../../supabase-client.ts";
import { useErrorStore } from "../../store/error-store.ts";

const { handleError } = useErrorStore.getState();

export async function getMessages(chatId: number, signal: AbortSignal) {
	const { data, error } = await supabase
		.from("chat_messages")
		.select("*")
		.eq("chat_id", chatId)
		.order("created_at", { ascending: true })
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
