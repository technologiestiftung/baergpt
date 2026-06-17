import { supabase } from "../../../supabase-client";

export async function deactivateAllowedEmailDomain(
	domain: string,
): Promise<boolean> {
	const { error } = await supabase.rpc("deactivate_allowed_domain", {
		p_domain: domain,
	});

	if (error) {
		console.error("Failed to deactivate allowed email domain:", error);
		return false;
	}

	return true;
}
