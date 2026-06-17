import { supabase } from "../../../supabase-client";
import type { AllowedEmailDomain } from "../../common";

export async function getAllowedEmailDomains(
	signal: AbortSignal,
): Promise<AllowedEmailDomain[]> {
	const { data, error } = await supabase
		.rpc("get_allowed_email_domains_admin")
		.abortSignal(signal);

	if (error) {
		console.error("Failed to fetch allowed email domains:", error);
		return [];
	}

	return data ?? [];
}
