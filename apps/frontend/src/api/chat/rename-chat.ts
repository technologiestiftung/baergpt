import { supabase } from "../../../supabase-client.ts";

export async function renameChat(
	chatId: number,
	newName: string,
): Promise<void> {
	const { error: renameChatError } = await supabase
		.from("chats")
		.update({ name: newName })
		.eq("id", chatId);

	if (renameChatError) {
		throw renameChatError;
	}
}
