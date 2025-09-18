import { supabase } from "../../../supabase-client";

export async function deleteUser(): Promise<{ error: Error | null }> {
	const { error } = await supabase.rpc("delete_user");
	return { error };
}
