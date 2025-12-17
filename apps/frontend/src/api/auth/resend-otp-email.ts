import { supabase } from "../../../supabase-client.ts";

export async function resendOtpEmail({
	email,
	otpType,
}: {
	email: string;
	otpType: "email" | "email_change";
}) {
	if (otpType === "email") {
		return supabase.auth.resend({
			email,
			type: "signup",
		});
	}

	return supabase.auth.resend({
		email,
		type: "email_change",
	});
}
