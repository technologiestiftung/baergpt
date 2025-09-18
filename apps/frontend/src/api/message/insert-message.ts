import { supabase } from "../../../supabase-client.ts";
import type { NewChatMessage } from "../../common.ts";

export async function insertMessage(
	chatId: number,
	chatMessage: NewChatMessage,
) {
	const { data, error } = await supabase
		.from("chat_messages")
		.insert({
			chat_id: chatId,
			created_at: new Date(),
			role: chatMessage.role,
			type: chatMessage.type,
			content: chatMessage.content,
			allowed_document_ids: chatMessage.allowed_document_ids,
			allowed_folder_ids: chatMessage.allowed_folder_ids,
			citations: chatMessage.citations,
		})
		.select("*");

	if (error) {
		throw error;
	}

	return data[0];
}
