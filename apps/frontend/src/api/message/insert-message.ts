import { supabase } from "../../../supabase-client.ts";
import type { ChatMessage, NewChatMessage } from "../../common.ts";

export async function insertMessage(
	chatId: number,
	chatMessage: NewChatMessage,
) {
	const { data, error } = await supabase
		.from("chat_messages")
		.insert({
			chat_id: chatId,
			created_at: new Date().toISOString(),
			role: chatMessage.role,
			type: chatMessage.type,
			content: chatMessage.content,
			allowed_document_ids: chatMessage.allowed_document_ids,
			allowed_folder_ids: chatMessage.allowed_folder_ids,
			citations: chatMessage.citations,
		})
		.select("*")
		.single();

	if (error) {
		throw error;
	}

	/**
	 * The `citations` field inside a message is typed
	 * as `Jsonb | null` in the DB, which does not exist in Typescript.
	 * It actually is `number[] | null`, so we cast it here.
	 */
	return data as ChatMessage;
}
