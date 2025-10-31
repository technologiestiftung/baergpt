import { supabase } from "../../../supabase-client";
import type { Document } from "../../common";
import { useAuthStore } from "../../store/auth-store";
import { useErrorStore } from "../../store/error-store.ts";

export async function getDocuments(signal: AbortSignal): Promise<Document[]> {
	const { session } = useAuthStore.getState();

	if (!session?.user.id) {
		return [];
	}

	const { data, error } = await supabase
		.from("documents")
		.select("*")
		.eq("owned_by_user_id", session.user.id)
		.not("processing_finished_at", "is", null) // Exclude rows with null "processing_finished_at"
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		useErrorStore.getState().handleError(error);
		useErrorStore.getState().setError("documents_fetch_failed");
		return [];
	}

	/**
	 * source_type is typed as `string | null` in the DB,
	 * but it is actually `"public_document" | "personal_document"`.
	 * So we cast it.
	 */
	return (data as Document[]) ?? [];
}
