import { supabase } from "../../../supabase-client.ts";

export async function getIsUserBanned() {
	const { data, error } = await supabase.rpc("is_current_user_banned");

	if (error) {
		throw error;
	}

	return data;
}
