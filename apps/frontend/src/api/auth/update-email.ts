import { supabase } from "../../../supabase-client";

export async function updateEmail(
	newEmail: string,
): Promise<{ error: Error | null }> {
	const emailRedirectTo =
		import.meta.env.VITE_EMAIL_CHANGE_REDIRECT_URL ??
		`${window.location.origin}/email-changed/`;
	const { error } = await supabase.auth.updateUser(
		{ email: newEmail },
		{
			emailRedirectTo,
		},
	);

	return { error };
}
