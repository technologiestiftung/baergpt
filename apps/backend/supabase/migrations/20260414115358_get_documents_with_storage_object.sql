CREATE OR REPLACE FUNCTION get_documents_with_storage_objects (p_limit int4, p_offset int4) RETURNS TABLE (source_url TEXT, bucket_id TEXT, version TEXT) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
RETURN QUERY
SELECT d.source_url, o.bucket_id, o.version
FROM public.documents d
JOIN storage.objects o ON d.source_url = o.name
ORDER BY d.id
LIMIT p_limit
OFFSET p_offset;
END;
$$;

-- Revoke from public and grant only to service_role
REVOKE ALL ON FUNCTION get_documents_with_storage_objects (int4, int4)
FROM
    PUBLIC;

REVOKE ALL ON FUNCTION get_documents_with_storage_objects (int4, int4)
FROM
    anon;

REVOKE ALL ON FUNCTION get_documents_with_storage_objects (int4, int4)
FROM
    authenticated;

GRANT
EXECUTE ON FUNCTION get_documents_with_storage_objects (int4, int4) TO service_role;
