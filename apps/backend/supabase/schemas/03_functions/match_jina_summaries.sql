CREATE OR REPLACE FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[] DEFAULT NULL::INTEGER[]
) RETURNS TABLE ("id" INTEGER, "document_id" INTEGER, "summary" "text", "similarity" DOUBLE PRECISION) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
RETURN QUERY
SELECT ds.id, ds.document_id, ds.summary, (ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1 AS similarity
FROM public.document_summaries ds
WHERE ((search_type='favorites' AND ds.document_id=ANY(allowed_document_ids)) OR (search_type='all_private' AND ds.owned_by_user_id=user_id)
    OR (search_type='private_folder' AND ds.owned_by_user_id=user_id AND ds.folder_id=ANY(allowed_folder_ids))
    OR (search_type='public_only' AND ds.owned_by_user_id IS NULL))
  AND (ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1>match_threshold
ORDER BY ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding LIMIT match_count;
END;
$$;

ALTER FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) TO "anon";

GRANT ALL ON FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) TO "service_role";
