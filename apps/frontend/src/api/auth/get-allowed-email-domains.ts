import { supabase } from "../../../supabase-client";
import { useAuthErrorStore } from "../../store/auth-error-store";

export async function getAllowedEmailDomains(
	signal: AbortSignal,
): Promise<string[]> {
	const { data: allowedDomains, error: rpcError } = await supabase
		.rpc("get_allowed_email_domains")
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (rpcError) {
		useAuthErrorStore.getState().handleError(new Error(rpcError.message));
		throw new Error(rpcError.message);
	}

	return allowedDomains?.map((item) => item.domain) || [];
}
