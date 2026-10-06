CREATE OR REPLACE FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) RETURNS TABLE (
    "chunk_id" INTEGER,
    "file_name" "text",
    "source_url" "text",
    "page" INTEGER,
    "created_at" TIMESTAMP WITH TIME ZONE,
    "source_type" "text",
    "snippet" "text"
) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
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

ALTER FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) TO "anon";

GRANT ALL ON FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) TO "service_role";
