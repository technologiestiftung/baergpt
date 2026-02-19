-- Function to get external citations for multiple messages
CREATE OR REPLACE FUNCTION get_external_citations_for_messages (message_ids BIGINT[]) RETURNS TABLE (
    id TEXT,
    message_id BIGINT,
    snippet TEXT,
    page INTEGER,
    file_name TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ,
    source_type TEXT
) LANGUAGE plpgsql SECURITY INVOKER
SET
    search_path = '' AS $$
BEGIN
	RETURN QUERY
	SELECT
		ec.id,
		ec.message_id,
		ec.snippet,
		ec.page,
		ec.file_name,
		ec.source_url,
		ec.created_at,
		ec.source_type
	FROM public.external_citations ec
	WHERE ec.message_id = ANY(message_ids);
END;
$$;
