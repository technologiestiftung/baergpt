import { supabase } from "../../../supabase-client";

export async function removeAllowedIndividualEmail(
	email: string,
): Promise<boolean> {
	const { error } = await supabase.rpc("remove_allowed_individual_email", {
		p_email: email,
	});

	if (error) {
		console.error("Failed to remove allowed individual email:", error);
		return false;
	}

	return true;
}
