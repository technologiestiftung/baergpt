import { supabase } from "../../../supabase-client";

export async function deleteUser(): Promise<{ error: Error | null }> {
	const { error } = await supabase.rpc("delete_user");
	if (!error) {
		return { error: null };
	}
	return {
		error: new Error("account_deletion_failed", {
			cause: error,
		} as ErrorOptions),
	};
}
