import { supabase } from "../../../supabase-client";
import type { User } from "../../common";
import { useErrorStore } from "../../store/error-store.ts";

export async function getUser(
	userId: string,
	signal: AbortSignal,
): Promise<User | null> {
	const { data: user, error } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", userId)
		.abortSignal(signal)
		.single();

	if (signal.aborted) {
		return null;
	}

	if (error) {
		useErrorStore.getState().handleError(error);
		return null;
	}

	return user;
}
