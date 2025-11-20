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
		.or(
			[
				`owned_by_user_id.eq.${session.user.id}`,
				"and(source_type.eq.default_document,owned_by_user_id.is.null)",
			].join(","), // Fetch user docs (owned_by_user_id = userId) OR default docs (source_type=default_document & owned_by_user_id=null)
		)
		.not("processing_finished_at", "is", null) // Exclude rows with null "processing_finished_at"
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		useErrorStore.getState().handleError(error);
		useErrorStore
			.getState()
			.setUIError("documents-fetch", "documents_fetch_failed", {
				autoClean: false,
			});
		return [];
	}

	/**
	 * source_type is typed as `string | null` in the DB,
	 * but it is actually `"public_document" | "personal_document" | "default_document"`.
	 * So we cast it.
	 */
	return (data as Document[]) ?? [];
}
