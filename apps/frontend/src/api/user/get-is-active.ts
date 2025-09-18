import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";

export async function getIsActive(
	signal: AbortSignal,
): Promise<boolean | null> {
	const { data: isActive, error: rpcError } = await supabase
		.rpc("is_current_user_active")
		.abortSignal(signal);

	if (signal.aborted) {
		return null;
	}

	if (rpcError) {
		useErrorStore.getState().handleError(rpcError);
		return null;
	}

	return isActive;
}
