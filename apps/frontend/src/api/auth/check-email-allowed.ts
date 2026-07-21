import { supabase } from "../../../supabase-client";

/**
 * Calls the check_email_allowed RPC to validate an email against
 * the domain allowlist and individual email allowlist.
 * Returns true if allowed, false if not or on error.
 */
export async function checkEmailAllowed(
	email: string,
	signal: AbortSignal,
): Promise<
	{ isAllowed: boolean; error: null } | { isAllowed: null; error: Error }
> {
	const { data: isAllowed, error } = await supabase
		.rpc("check_email_allowed", { p_email: email })
		.abortSignal(signal);

	if (signal.aborted) {
		return { isAllowed: null, error: new Error("Request was aborted") };
	}

	if (error) {
		return { isAllowed: null, error };
	}

	return { isAllowed, error: null };
}
