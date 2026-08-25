import { supabase } from "../../../supabase-client.ts";

export async function getIsUserBannedOrDeleted() {
	const { data, error } = await supabase.rpc(
		"is_current_user_banned_or_deleted",
	);

	if (error) {
		throw error;
	}

	return data;
}
