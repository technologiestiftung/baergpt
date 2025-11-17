import { supabase } from "../../../supabase-client";
import type { Document } from "../../common";
import { useErrorStore } from "../../store/error-store.ts";

export async function getPublicDocuments(
	signal: AbortSignal,
): Promise<Document[]> {
	const { data, error } = await supabase
		.from("documents")
		.select("*")
		.eq("source_type", "public_document")
		.is("owned_by_user_id", null)
		.not("processing_finished_at", "is", null) // Exclude rows with null "processing_finished_at"
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		useErrorStore.getState().handleError(error);
		useErrorStore
			.getState()
			.setUIError("public-documents-fetch", "public_documents_fetch_failed", {
				autoClean: false,
			});
		return [];
	}

	return (data as Document[]) ?? [];
}
