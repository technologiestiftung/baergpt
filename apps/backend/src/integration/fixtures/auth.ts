import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceRoleDbClient } from "../../supabase";

/**
 * Signs `client` in as `email` via email OTP, like the login page does. The code comes
 * from `generateLink` instead of a sent mail. Each call creates a new session.
 */
export async function signInWithOtp(
	client: Pick<SupabaseClient, "auth">,
	email: string,
) {
	const { data, error } = await serviceRoleDbClient.auth.admin.generateLink({
		type: "magiclink",
		email,
	});
	if (error) {
		throw new Error(`Failed to generate OTP for ${email}: ${error.message}`);
	}

	return client.auth.verifyOtp({
		email,
		token: data.properties.email_otp,
		type: "email",
	});
}
