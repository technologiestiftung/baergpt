import { supabase } from "../../../supabase-client";

export async function updateUserMetadata(
	first_name: string,
	last_name: string,
): Promise<void> {
	const { error: authError } = await supabase.auth.updateUser({
		data: {
			first_name,
			last_name,
		},
	});

	if (authError) {
		throw authError;
	}
}
