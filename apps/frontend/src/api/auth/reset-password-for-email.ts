import { supabase } from "../../../supabase-client";
import { useAuthErrorStore } from "../../store/auth-error-store";

/**
 * Sends a password reset email to the specified email address.
 * @param {string} email - The email address to send the reset link to.
 * @param {string} redirectTo - The URL to redirect the user to after they click the reset link.
 */
export async function resetPasswordForEmail(
	email: string,
	redirectTo: string,
): Promise<void> {
	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo,
	});

	if (error) {
		useAuthErrorStore.getState().handleError(error);
		throw new Error(error.message);
	}
}
