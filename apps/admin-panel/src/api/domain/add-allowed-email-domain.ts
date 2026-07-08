import { supabase } from "../../../supabase-client";

export async function addAllowedEmailDomain(domain: string): Promise<boolean> {
	const { error } = await supabase.rpc("add_allowed_domain", {
		p_domain: domain,
	});

	if (error) {
		console.error("Failed to add allowed email domain:", error);
		return false;
	}

	return true;
}
