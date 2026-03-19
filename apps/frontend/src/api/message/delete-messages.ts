import { supabase } from "../../../supabase-client.ts";

export async function deleteMessages(messageIds: number[]) {
	return supabase.from("chat_messages").delete().in("id", messageIds);
}
