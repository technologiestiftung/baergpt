CREATE OR REPLACE FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[] DEFAULT NULL::INTEGER[]
) RETURNS TABLE ("id" INTEGER, "document_id" INTEGER, "content" "text", "similarity" DOUBLE PRECISION) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
RETURN QUERY
SELECT dc.id, dc.document_id, dc.content, (dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1 AS similarity
FROM public.document_chunks dc
WHERE ((search_type='favorites' AND dc.document_id=ANY(allowed_document_ids)) OR (search_type='all_private' AND dc.owned_by_user_id=user_id)
    OR (search_type='private_folder' AND dc.owned_by_user_id=user_id AND dc.folder_id=ANY(allowed_folder_id))
    OR (search_type='public_only' AND dc.owned_by_user_id IS NULL))
  AND (dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1>match_threshold
ORDER BY dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding LIMIT match_count;
END;
$$;

ALTER FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) TO "anon";

GRANT ALL ON FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) TO "service_role";
