import { supabase } from "../../../supabase-client";
import { useAuthErrorStore } from "../../store/auth-error-store";
import { useAuthStore } from "../../store/auth-store";

export async function logAccountActivation(): Promise<void> {
	const userId = useAuthStore.getState().session?.user?.id;

	if (!userId) {
		const error = new Error("No user ID found for account activation logging");
		useAuthErrorStore.getState().handleError(error);
		throw error;
	}

	const { error } = await supabase.rpc("log_account_activation");

	if (error) {
		useAuthErrorStore.getState().handleError(new Error(error.message));
		throw new Error(error.message);
	}
}
