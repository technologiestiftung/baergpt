import { supabase } from "../../../supabase-client";
import { useAuthErrorStore } from "../../store/auth-error-store";

// Verifies if the provided password matches the current user's password
export async function verifyPassword(
	plainPassword: string,
): Promise<{ data: boolean | null; error: Error | null }> {
	const { data, error } = await supabase.rpc("verify_own_password", {
		plain_password: plainPassword,
	});

	if (error) {
		useAuthErrorStore.getState().handleError(new Error(error.message));
		return { data: null, error };
	}

	return { data: data === true, error: null };
}
