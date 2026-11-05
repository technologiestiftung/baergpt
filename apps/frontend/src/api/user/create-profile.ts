import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

export async function createProfile({
	first_name,
	last_name,
}: {
	first_name: string;
	last_name: string;
}): Promise<void> {
	// Upsert, as users created by an admin may already have a profile without names
	const { error } = await supabase.from("profiles").upsert({
		id: useAuthStore.getState().session?.user?.id ?? "",
		first_name,
		last_name,
	});

	if (error) {
		throw error;
	}
}
