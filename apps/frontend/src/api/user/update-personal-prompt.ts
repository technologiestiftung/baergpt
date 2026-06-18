import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

export async function updatePersonalPrompt(
	personalPrompt: string,
): Promise<{ error: Error | null }> {
	const { error } = await supabase
		.from("profiles")
		.update({
			personal_system_prompt: personalPrompt,
		})
		.eq("id", useAuthStore.getState().session?.user?.id ?? "")
		.select();

	return { error };
}
