import { supabase } from "../../../supabase-client.ts";

export async function resendEmailConfirmation(email: string) {
	return supabase.auth.resend({
		email,
		type: "signup",
	});
}
