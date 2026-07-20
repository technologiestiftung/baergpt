import { supabase } from "../../../supabase-client";

export async function addAllowedIndividualEmail(email: string) {
	const { error } = await supabase.rpc("add_allowed_individual_email", {
		p_email: email,
	});

	if (error) {
		console.error(error);
	}

	return { error };
}
