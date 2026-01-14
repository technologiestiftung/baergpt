CREATE OR REPLACE FUNCTION get_citation_details (
	chunk_ids INTEGER[],
	allowed_document_ids INTEGER[] DEFAULT NULL::INTEGER[],
	allowed_folder_ids INTEGER[] DEFAULT NULL::INTEGER[]
) returns TABLE (
	chunk_id INTEGER,
	file_name TEXT,
	source_url TEXT,
	page INT,
	created_at TIMESTAMPTZ,
	source_type TEXT,
	snippet TEXT
) language plpgsql
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
    WHERE document_chunk.id = ANY(chunk_ids)
        AND (allowed_document_ids IS NULL OR document.id = ANY(allowed_document_ids))
        AND (allowed_folder_ids IS NULL OR document.folder_id = ANY(allowed_folder_ids));
END;
$$;
