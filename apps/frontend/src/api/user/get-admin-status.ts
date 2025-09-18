import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";

export async function getAdminStatus(signal: AbortSignal): Promise<boolean> {
	const { data: isAdmin, error: rpcError } = await supabase
		.rpc("is_application_admin")
		.abortSignal(signal);

	if (signal.aborted) {
		return false;
	}

	if (rpcError) {
		useErrorStore.getState().handleError(rpcError);
		return false;
	}

	return isAdmin || false;
}
