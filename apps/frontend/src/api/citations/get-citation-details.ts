import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import type { CitationWithDetails, SourceType } from "../../common";

export type CitationWithChunkId = CitationWithDetails & { chunkId: number };

type CitationDetailsFromDb = {
	chunk_id: number;
	file_name: string;
	source_url: string;
	page: number;
	created_at: string;
	source_type: string;
	snippet: string;
};

export async function getCitationDetails(
	chunkIds: number[],
): Promise<CitationWithChunkId[]> {
	const { handleError } = useErrorStore.getState();

	const { data, error } = await supabase.rpc("get_citation_details", {
		chunk_ids: chunkIds,
	});

	if (error) {
		handleError(error);
	}
	const dbCitations = data ?? [];

	return dbCitations.map((dbCitation: CitationDetailsFromDb) => ({
		chunkId: Number(dbCitation.chunk_id),
		fileName: dbCitation.file_name,
		sourceUrl: dbCitation.source_url,
		page: dbCitation.page,
		createdAt: dbCitation.created_at,
		sourceType: dbCitation.source_type as SourceType,
		snippet: dbCitation.snippet,
	}));
}
