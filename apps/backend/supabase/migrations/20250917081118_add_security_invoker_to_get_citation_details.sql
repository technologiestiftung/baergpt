DROP FUNCTION if EXISTS get_citation_details;

CREATE OR REPLACE FUNCTION get_citation_details (chunk_ids INTEGER[]) returns TABLE (
    chunk_id INTEGER,
    file_name TEXT,
    source_url TEXT,
    page INT,
    created_at TIMESTAMPTZ,
    source_type TEXT,
    snippet TEXT
) language plpgsql security invoker
SET
    search_path = '' AS $$
BEGIN
	RETURN QUERY
		SELECT
			document_chunk.id AS chunk_id,
			document.file_name,
			document.source_url,
			document_chunk.page,
			document.created_at,
			document.source_type,
			document_chunk.content AS snippet
		FROM public.document_chunks document_chunk
					 JOIN public.documents document ON document.id = document_chunk.document_id
		WHERE document_chunk.id = ANY(chunk_ids);
END;
$$;
