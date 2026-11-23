import { supabase } from "../../../supabase-client.ts";

// Keeps the `id=in.(…)` query string well below common URL length limits
const DELETE_BATCH_SIZE = 150;

export async function deleteChats(
	chatIds: number[],
): Promise<{ deletedChatIds: number[]; error: Error | null }> {
	const deletedChatIds: number[] = [];

	for (let start = 0; start < chatIds.length; start += DELETE_BATCH_SIZE) {
		const batch = chatIds.slice(start, start + DELETE_BATCH_SIZE);
		const { error } = await supabase.from("chats").delete().in("id", batch);

		if (error) {
			return { deletedChatIds, error };
		}

		deletedChatIds.push(...batch);
	}

	return { deletedChatIds, error: null };
}
