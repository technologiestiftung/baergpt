import { supabase } from "../../../supabase-client";
import type { UserProfile } from "../../common";

export async function getUser(
	userId: string,
	signal: AbortSignal,
): Promise<UserProfile | null> {
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
		console.error("Error fetching user:", error);
		return null;
	}

	return user;
}
