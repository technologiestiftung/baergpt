import { supabase } from "../../../supabase-client";
import type { Document } from "../../common";

export async function getDocuments(signal: AbortSignal): Promise<Document[]> {
	const { data, error } = await supabase
		.from("documents")
		.select("*")
		.is("owned_by_user_id", null) // Fetch only documents where owned_by_user_id is null
		.not("source_type", "is", "default_document") // Exclude default documents
		.not("processing_finished_at", "is", null) // Exclude rows with null "processing_finished_at"
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		console.error("Error fetching documents:", error);
		return [];
	}

	return data ?? [];
}
