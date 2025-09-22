import { User } from "../../common";
import { supabase } from "../../../supabase-client";

export async function getUsers(
	signal: AbortSignal,
): Promise<{ users: User[]; error: Error | null } | null> {
	const { data, error } = await supabase.rpc("get_users").abortSignal(signal);

	if (signal.aborted) {
		return null;
	}

	if (error) {
		return { users: [], error };
	}

	return { users: data || [], error: null };
}
