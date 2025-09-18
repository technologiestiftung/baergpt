import { supabase } from "../../../supabase-client";

export async function updateEmail(
	newEmail: string,
): Promise<{ error: Error | null }> {
	const { error } = await supabase.auth.updateUser({ email: newEmail });

	return { error };
}
