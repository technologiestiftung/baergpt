DROP FUNCTION if EXISTS public.match_jina_document_chunks;

CREATE FUNCTION public.match_jina_document_chunks (
    embedding vector,
    match_threshold DOUBLE PRECISION,
    match_count INTEGER,
    num_probes INTEGER,
    user_id UUID,
    search_type TEXT,
    allowed_processed_document_ids INTEGER[],
    allowed_folder_ids INTEGER[] DEFAULT NULL
) returns TABLE (id INTEGER, processed_document_id INTEGER, content TEXT, similarity DOUBLE PRECISION) language plpgsql AS $function$
	#variable_conflict use_variable
BEGIN
EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
RETURN query
SELECT
    processed_document_chunks.id,
    processed_document_chunks.processed_document_id,
    processed_document_chunks.content,
    (processed_document_chunks.chunk_jina_embedding <#> embedding) * -1 as similarity
FROM
    processed_document_chunks
WHERE
    (
        (search_type = 'favorites' AND (processed_document_chunks.processed_document_id = ANY (allowed_processed_document_ids)))
            OR
        (search_type = 'all_private' AND (processed_document_chunks.owned_by_user_id = user_id))
            OR
        (search_type = 'private_folder' AND (processed_document_chunks.owned_by_user_id = user_id) AND (processed_document_chunks.folder_id = ANY(allowed_folder_ids)))
            OR
        (search_type = 'public_only' AND (processed_document_chunks.owned_by_user_id IS NULL))
        )
  AND (processed_document_chunks.chunk_jina_embedding <#> embedding) * -1 > match_threshold
ORDER BY
    processed_document_chunks.chunk_jina_embedding <#> embedding
    LIMIT match_count;
END;
$function$;

DROP FUNCTION if EXISTS public.match_jina_summaries;

CREATE FUNCTION public.match_jina_summaries (
    embedding vector,
    match_threshold DOUBLE PRECISION,
    match_count INTEGER,
    num_probes INTEGER,
    user_id UUID,
    search_type TEXT,
    allowed_processed_document_ids INTEGER[],
    allowed_folder_ids INTEGER[] DEFAULT NULL
) returns TABLE (id INTEGER, processed_document_id INTEGER, summary TEXT, similarity DOUBLE PRECISION) language plpgsql AS $function$
	#variable_conflict use_variable
BEGIN
EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
RETURN query
SELECT
    processed_document_summaries.id,
    processed_document_summaries.processed_document_id,
    processed_document_summaries.summary,
    (processed_document_summaries.summary_jina_embedding <#> embedding) * -1 as similarity
FROM
    processed_document_summaries
WHERE
    (
        (search_type = 'favorites' AND (processed_document_summaries.processed_document_id = ANY (allowed_processed_document_ids)))
            OR
        (search_type = 'all_private' AND (processed_document_summaries.owned_by_user_id = user_id))
            OR
        (search_type = 'private_folder' AND (processed_document_summaries.owned_by_user_id = user_id) AND (processed_document_summaries.folder_id = ANY(allowed_folder_ids)))
            OR
        (search_type = 'public_only' AND (processed_document_summaries.owned_by_user_id IS NULL))
        )
  AND (processed_document_summaries.summary_jina_embedding <#> embedding) * -1 > match_threshold
ORDER BY
    processed_document_summaries.summary_jina_embedding <#> embedding
    LIMIT match_count;
END;
$function$;

DROP FUNCTION if EXISTS public.match_jina_summaries_and_chunks;

CREATE FUNCTION public.match_jina_summaries_and_chunks (
    embedding vector,
    match_threshold DOUBLE PRECISION,
    chunk_limit INTEGER,
    summary_limit INTEGER,
    num_probes_chunks INTEGER,
    num_probes_summaries INTEGER,
    user_id UUID,
    allowed_processed_document_ids INTEGER[],
    search_type TEXT,
    allowed_folder_ids INTEGER[] DEFAULT NULL
) returns TABLE (
    processed_document_id INTEGER,
    chunk_ids INTEGER[],
    chunk_similarities DOUBLE PRECISION[],
    avg_chunk_similarity DOUBLE PRECISION,
    summary_ids INTEGER[],
    summary_similarity DOUBLE PRECISION,
    similarity DOUBLE PRECISION
) language plpgsql AS $function$
	# variable_conflict use_variable
BEGIN
RETURN query WITH chunk_winners AS (
		SELECT
			cw.id AS chunk_id,
			NULL AS summary_id,
			cw.processed_document_id,
			cw.similarity
		FROM
			match_jina_document_chunks(
				embedding,
				match_threshold,
				chunk_limit,
				num_probes_chunks,
				user_id,
				search_type,
				allowed_processed_document_ids,
				allowed_folder_ids
			) AS cw
	),
	summary_winners AS (
		SELECT
			NULL AS chunk_id,
			sw.id AS summary_id,
			sw.processed_document_id,
			sw.similarity
		FROM
			match_jina_summaries(
				embedding,
				match_threshold,
				summary_limit,
				num_probes_summaries,
				user_id,
				search_type,
				allowed_processed_document_ids,
				allowed_folder_ids
			) AS sw
	),
	all_winners AS (
		SELECT
			chunk_winners.chunk_id,
			NULL AS summary_id,
			chunk_winners.processed_document_id,
			chunk_winners.similarity
		FROM
			chunk_winners
		UNION ALL
		SELECT
			NULL AS chunk_id,
			summary_winners.summary_id,
			summary_winners.processed_document_id,
			summary_winners.similarity
		FROM
			summary_winners
	)
SELECT
    winners.processed_document_id,
    ARRAY_AGG(winners.chunk_id) FILTER(WHERE winners.chunk_id IS NOT NULL) AS chunk_ids,
        ARRAY_AGG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL) AS chunk_similarities,
        AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL) AS avg_chunk_similarity,
        ARRAY_AGG(winners.summary_id) FILTER(WHERE winners.summary_id IS NOT NULL) AS summary_ids,
        AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL) AS summary_similarity,
        CASE
            WHEN ARRAY_LENGTH(ARRAY_AGG(winners.chunk_id) FILTER(WHERE winners.chunk_id IS NOT NULL), 1) IS NULL THEN
                coalesce(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL), 0)
            WHEN ARRAY_LENGTH(ARRAY_AGG(winners.summary_id) FILTER(WHERE winners.summary_id IS NOT NULL), 1) IS NULL THEN
                coalesce(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL), 0)
            ELSE
                (coalesce(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL), 0) + coalesce(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL), 0)) / 2.0
            END similarity
FROM
    all_winners AS winners
GROUP BY
    winners.processed_document_id
ORDER BY
    similarity DESC;
END;
$function$;
