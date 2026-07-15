import { supabase } from "../../../supabase-client";
import type { AllowedIndividualEmail } from "../../common";

export async function getAllowedIndividualEmails(
	signal: AbortSignal,
): Promise<AllowedIndividualEmail[]> {
	const { data, error } = await supabase
		.rpc("get_allowed_individual_emails")
		.abortSignal(signal);

	if (error) {
		throw error;
	}

	return data ?? [];
}
