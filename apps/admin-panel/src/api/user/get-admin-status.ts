import { supabase } from "../../../supabase-client";

export async function getAdminStatus(
	signal: AbortSignal,
): Promise<boolean | null> {
	try {
		const { data: isAdmin, error: rpcError } = await supabase
			.rpc("is_application_admin")
			.abortSignal(signal);

		if (signal.aborted) {
			return null;
		}
		if (rpcError) {
			console.error("Error checking admin status:", rpcError);
			return null;
		}

		return isAdmin;
	} catch (error) {
		console.error("Failed to check admin status:", error);
		return null;
	}
}
