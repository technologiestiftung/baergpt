import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

export async function updateAddressedFormal(
	isAddressedFormal: boolean,
): Promise<{ error: Error | null }> {
	const { error } = await supabase
		.from("profiles")
		.update({
			is_addressed_formal: isAddressedFormal,
		})
		.eq("id", useAuthStore.getState().session?.user?.id ?? "")
		.select();

	return { error };
}
