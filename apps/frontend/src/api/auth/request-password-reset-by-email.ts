import { supabase } from "../../../supabase-client";

/**
 * Sends a password reset email to the specified email address.
 * @param {string} email - The email address to send the reset link to.
 */
export async function requestPasswordResetByEmail(
	email: string,
): Promise<{ error: Error | null }> {
	return supabase.auth.resetPasswordForEmail(email);
}
