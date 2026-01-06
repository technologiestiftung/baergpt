import { supabase } from "../../../supabase-client";

export async function updateEmail(
	newEmail: string,
): Promise<{ error: Error | null }> {
	return supabase.auth.updateUser({ email: newEmail });
}
