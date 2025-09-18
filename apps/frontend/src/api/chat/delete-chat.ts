import { supabase } from "../../../supabase-client.ts";

export async function deleteChat(chatId: number) {
	const { error } = await supabase.from("chats").delete().eq("id", chatId);

	if (error) {
		throw error;
	}
}
