import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import type { CitationWithDetails } from "../../common";

type ExternalCitationFromDb = {
	id: string;
	message_id: number;
	snippet: string;
	page: number;
	file_name: string;
	source_url: string;
	created_at: string;
	source_type: string;
};

export async function getExternalCitationsForMessages(
	messageIds: number[],
): Promise<CitationWithDetails[]> {
	if (messageIds.length === 0) {
		return [];
	}

	const { handleError } = useErrorStore.getState();

	const { data, error } = await supabase.rpc(
		"get_external_citations_for_messages",
		{
			message_ids: messageIds,
		},
	);

	if (error) {
		handleError(error);
		return [];
	}

	const dbCitations = data ?? [];

	return dbCitations.map((dbCitation: ExternalCitationFromDb) => ({
		id: dbCitation.id,
		fileName: dbCitation.file_name,
		sourceUrl: dbCitation.source_url,
		page: dbCitation.page,
		createdAt: dbCitation.created_at,
		sourceType: dbCitation.source_type as CitationWithDetails["sourceType"],
		snippet: dbCitation.snippet,
	}));
}
