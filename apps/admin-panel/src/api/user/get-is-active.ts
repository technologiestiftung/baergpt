import { supabase } from "../../../supabase-client";

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
		console.error("Error checking user active status:", rpcError);
		return null;
	}

	return isActive;
}
