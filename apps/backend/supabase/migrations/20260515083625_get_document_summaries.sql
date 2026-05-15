CREATE OR REPLACE FUNCTION get_document_summaries (input_document_ids INTEGER[], input_folder_ids INTEGER[]) RETURNS TABLE (id INTEGER, file_name TEXT, created_at TIMESTAMPTZ, short_summary TEXT) LANGUAGE plpgsql STABLE SECURITY INVOKER
SET
    search_path = '' AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.file_name,
        d.created_at,
        ds.short_summary
    FROM public.documents d
             LEFT JOIN public.document_summaries ds ON ds.document_id = d.id
    WHERE
        d.id = ANY(input_document_ids)
       OR d.folder_id = ANY(input_folder_ids);
END;
$$;
