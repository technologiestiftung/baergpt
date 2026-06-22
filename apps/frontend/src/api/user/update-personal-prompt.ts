import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

export async function updatePersonalPrompt(
	personalPrompt: string,
): Promise<{ error: Error | null }> {
	const userId = useAuthStore.getState().session?.user?.id;
	if (!userId) {
		return { error: new Error("User is not authenticated") };
	}

	const { error } = await supabase
		.from("profiles")
		.update({
			personal_system_prompt: personalPrompt,
		})
		.eq("id", userId)
		.select();

	return { error };
}
