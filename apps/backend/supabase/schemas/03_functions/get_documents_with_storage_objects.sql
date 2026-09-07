CREATE OR REPLACE FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER) RETURNS TABLE ("source_url" "text", "bucket_id" "text", "storage_name" "text", "storage_version" "text") LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $_$
BEGIN
RETURN QUERY
SELECT d.source_url, o.bucket_id, o.name as storage_name, o.version as storage_version
FROM public.documents d
         JOIN storage.objects o ON d.source_url = o.name
    OR (d.source_url ~* '\.docx?$' AND o.name = regexp_replace(d.source_url, '\.docx?$', '.pdf', 'i'))
ORDER BY d.id
    LIMIT p_limit
OFFSET p_offset;
END;
$_$;

ALTER FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER)
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER) TO "service_role";
