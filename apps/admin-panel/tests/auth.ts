import type { Session } from "@supabase/supabase-js";
import { createAnonClient, supabaseAdminClient } from "./supabase.ts";

/**
 * Signs in via email OTP, like the login page does, and returns the session.
 * The code comes from `generateLink` instead of a sent mail. Each call creates a new session.
 */
export async function signInWithOtp(email: string): Promise<Session> {
	const { data: link, error: linkError } =
		await supabaseAdminClient.auth.admin.generateLink({
			type: "magiclink",
			email,
		});
	if (linkError) {
		throw new Error(
			`Failed to generate OTP for ${email}: ${linkError.message}`,
		);
	}

	const { data, error } = await createAnonClient().auth.verifyOtp({
		email,
		token: link.properties.email_otp,
		type: "email",
	});
	if (error || !data.session) {
		throw new Error(`Failed to verify OTP: ${error?.message ?? "no session"}`);
	}

	return data.session;
}
