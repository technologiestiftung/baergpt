import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import type { CitationWithDetails, SourceType } from "../../common";

type CitationDetailsFromDb = {
	citation_id: number;
	file_name: string;
	source_url: string;
	page: number;
	created_at: string;
	source_type: string;
	snippet: string;
};

export async function getCitationDetails(
	citationIds: number[],
): Promise<CitationWithDetails[]> {
	const { handleError } = useErrorStore.getState();

	const { data, error } = await supabase.rpc("get_citation_details", {
		citation_ids: citationIds,
	});

	if (error) {
		handleError(error);
	}
	const dbCitations = data ?? [];

	return dbCitations.map((dbCitation: CitationDetailsFromDb) => ({
		citationId: Number(dbCitation.citation_id),
		fileName: dbCitation.file_name,
		sourceUrl: dbCitation.source_url,
		page: dbCitation.page,
		createdAt: dbCitation.created_at,
		sourceType: dbCitation.source_type as SourceType,
		snippet: dbCitation.snippet,
	}));
}
