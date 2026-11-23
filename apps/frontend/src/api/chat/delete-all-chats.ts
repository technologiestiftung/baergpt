import { supabase } from "../../../supabase-client.ts";

/**
 * Deletes every chat owned by the given user in a single atomic statement,
 * relying on the existing row-level-security policy to scope it to their
 * own rows. Messages cascade-delete automatically.
 */
export async function deleteAllChats(
	userId: string,
): Promise<{ error: Error | null }> {
	const { error } = await supabase
		.from("chats")
		.delete()
		.eq("user_id", userId);

	return { error };
}
