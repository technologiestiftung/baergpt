import { supabase } from "../../../supabase-client";
import { Document } from "../../common";
import { useAuthStore } from "../../store/auth-store";
import { useErrorStore } from "../../store/error-store.ts";

export async function getDocuments(signal: AbortSignal): Promise<Document[]> {
	const { session } = useAuthStore.getState();

	const { data, error } = await supabase
		.from("documents")
		.select("*")
		.eq("owned_by_user_id", session?.user.id) // only fetch documents owned by the current user
		.not("processing_finished_at", "is", null) // Exclude rows with null "processing_finished_at"
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		useErrorStore.getState().handleError(error);
		return [];
	}

	return data ?? [];
}
