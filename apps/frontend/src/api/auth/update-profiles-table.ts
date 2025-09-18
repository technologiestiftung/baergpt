import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

interface UpdateProfilesTableParams {
	first_name: string;
	last_name: string;
	academic_title: string;
	personal_title: string;
}

export async function updateProfilesTable(
	userData: UpdateProfilesTableParams,
): Promise<void> {
	const { error: profileError } = await supabase
		.from("profiles")
		.update({
			first_name: userData.first_name,
			last_name: userData.last_name,
			academic_title: userData.academic_title,
			personal_title: userData.personal_title,
		})
		.eq("id", useAuthStore.getState().session?.user?.id ?? "")
		.select();

	if (profileError) {
		throw profileError;
	}
}
