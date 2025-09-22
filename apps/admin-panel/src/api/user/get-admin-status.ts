import { supabase } from "../../../supabase-client";

export async function getAdminStatus(signal: AbortSignal): Promise<boolean> {
	try {
		const { data: isAdmin, error: rpcError } = await supabase
			.rpc("is_application_admin")
			.abortSignal(signal);

		if (signal.aborted) {
			return false;
		}
		if (rpcError) {
			console.error("Error checking admin status:", rpcError);
			return false;
		}
		return isAdmin || false;
	} catch (error) {
		console.error("Failed to check admin status:", error);
		return false;
	}
}
