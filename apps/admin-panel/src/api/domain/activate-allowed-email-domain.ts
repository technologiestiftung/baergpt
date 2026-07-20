import { supabase } from "../../../supabase-client";

export async function activateAllowedEmailDomain(
	domain: string,
): Promise<boolean> {
	const { error } = await supabase.rpc("activate_allowed_domain", {
		p_domain: domain,
	});

	if (error) {
		console.error("Failed to activate allowed email domain:", error);
		return false;
	}

	return true;
}
