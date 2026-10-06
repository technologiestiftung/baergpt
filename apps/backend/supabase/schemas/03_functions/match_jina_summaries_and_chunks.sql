CREATE OR REPLACE FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[] DEFAULT NULL::INTEGER[]
) RETURNS TABLE (
    "document_id" INTEGER,
    "chunk_ids" INTEGER[],
    "chunk_similarities" DOUBLE PRECISION[],
    "avg_chunk_similarity" DOUBLE PRECISION,
    "summary_ids" INTEGER[],
    "summary_similarity" DOUBLE PRECISION,
    "similarity" DOUBLE PRECISION
) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
RETURN QUERY WITH chunk_winners AS (
    SELECT cw.id AS chunk_id, NULL::integer AS summary_id, cw.document_id, cw.similarity
    FROM public.match_jina_document_chunks(query_embedding,match_threshold,chunk_limit,num_probes_chunks,user_id,search_type,allowed_document_ids,allowed_folder_ids) cw
  ), summary_winners AS (
    SELECT NULL::integer AS chunk_id, sw.id AS summary_id, sw.document_id, sw.similarity
    FROM public.match_jina_summaries(query_embedding,match_threshold,summary_limit,num_probes_summaries,user_id,search_type,allowed_document_ids,allowed_folder_ids) sw
  ), all_winners AS (
    SELECT * FROM chunk_winners UNION ALL SELECT * FROM summary_winners
  )
SELECT winners.document_id, ARRAY_AGG(winners.chunk_id) FILTER(WHERE winners.chunk_id IS NOT NULL),
    ARRAY_AGG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL), AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),
    ARRAY_AGG(winners.summary_id) FILTER(WHERE winners.summary_id IS NOT NULL), AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),
    CASE WHEN COUNT(winners.chunk_id)=0 THEN COALESCE(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),0)
         WHEN COUNT(winners.summary_id)=0 THEN COALESCE(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),0)
         ELSE (COALESCE(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),0)+COALESCE(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),0))/2 END
        AS similarity
FROM all_winners winners GROUP BY winners.document_id ORDER BY similarity DESC;
END;
$$;

ALTER FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) TO "anon";

GRANT ALL ON FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) TO "service_role";
