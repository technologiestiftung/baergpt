import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";

export async function getMaintenanceModeStatus(
	signal: AbortSignal,
): Promise<boolean> {
	const { data, error } = await supabase
		.rpc("get_maintenance_mode_status")
		.abortSignal(signal);

	if (signal.aborted) {
		return false;
	}

	if (error) {
		useErrorStore.getState().handleError(error);
		return false;
	}

	return data ?? false;
}
