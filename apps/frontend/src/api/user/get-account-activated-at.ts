import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";

export async function getAccountActivationTimestamp(): Promise<string | null> {
	const { data: timestamp, error } = await supabase.rpc(
		"get_account_activation_timestamp",
	);

	if (error) {
		useErrorStore.getState().handleError(error);
		return null;
	}

	return timestamp;
}
