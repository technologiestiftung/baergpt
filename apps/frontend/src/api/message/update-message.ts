import { supabase } from "../../../supabase-client.ts";
import type { ChatMessage } from "../../common.ts";

export async function updateMessage(
	messageId: number,
	payload: Partial<ChatMessage>,
) {
	const { error } = await supabase
		.from("chat_messages")
		.update(payload)
		.eq("id", messageId);

	if (error) {
		throw error;
	}
}
