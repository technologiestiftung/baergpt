import { supabase } from "../../../supabase-client";
import { useAuthErrorStore } from "../../store/auth-error-store";

export async function updatePassword(
	newPassword: string,
): Promise<{ error: Error | null }> {
	const { error } = await supabase.auth.updateUser({ password: newPassword });

	if (error) {
		useAuthErrorStore.getState().handleError(new Error(error.message));
		return { error };
	}

	return { error: null };
}
