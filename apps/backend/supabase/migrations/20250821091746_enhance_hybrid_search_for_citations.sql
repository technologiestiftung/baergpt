-- enhance hybrid search by exposing more parameters needed for proper citations
DROP FUNCTION if EXISTS public.hybrid_chunk_search (
    query_text TEXT,
    query_embedding extensions.vector (1024),
    match_count INTEGER,
    allowed_document_ids INTEGER[],
    allowed_folder_ids INTEGER[],
    full_text_weight DOUBLE PRECISION,
    semantic_weight DOUBLE PRECISION,
    rrf_k INTEGER
);

CREATE OR REPLACE FUNCTION public.hybrid_chunk_search (
    query_text TEXT,
    query_embedding extensions.vector (1024),
    match_count INTEGER,
    allowed_document_ids INTEGER[] DEFAULT NULL::INTEGER[],
    allowed_folder_ids INTEGER[] DEFAULT NULL::INTEGER[],
    full_text_weight DOUBLE PRECISION DEFAULT 1,
    semantic_weight DOUBLE PRECISION DEFAULT 1,
    rrf_k INTEGER DEFAULT 50
) returns TABLE (
    chunk_id INTEGER,
    document_id INTEGER,
    chunk_content TEXT,
    page INTEGER,
    source_url TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ,
    source_type TEXT,
    fts_score REAL,
    sem_score REAL,
    hybrid_score REAL
) language sql
SET
    search_path = 'extensions' AS $$
WITH full_text AS (
  SELECT
    id AS chunk_id,
    document_id,
    pg_catalog.ts_rank_cd(full_text_search,
                 pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery, 32) AS fts_score,
    pg_catalog.row_number() over(order BY pg_catalog.ts_rank_cd(full_text_search, pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery) desc) AS rank_ix
  FROM
    public.document_chunks
  WHERE
    full_text_search @@ pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery
    AND (
      (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
      OR (allowed_folder_ids IS NOT NULL AND folder_id = any(allowed_folder_ids))
    )
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
),
semantic AS (
  SELECT
    id AS chunk_id,
    document_id,
    1 - (chunk_jina_embedding <=> query_embedding) AS sem_score, -- cosine similarity
    pg_catalog.row_number() over (ORDER BY chunk_jina_embedding <=> query_embedding) AS rank_ix -- using cosine distance
  FROM
    public.document_chunks
  WHERE
    chunk_jina_embedding IS NOT NULL
    AND (
      (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
      OR (allowed_folder_ids IS NOT NULL AND folder_id = any(allowed_folder_ids))
    )
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
)
SELECT
  chunks.id AS chunk_id,
  chunks.document_id,
  chunks.content AS chunk_content,
  chunks.page,
  docs.source_url,
  docs.file_name,
  docs.created_at,
  docs.source_type,
  full_text.fts_score,
  semantic.sem_score,
  COALESCE(1.0/(rrf_k + full_text.rank_ix), 0) * full_text_weight + 
  COALESCE(1.0/(rrf_k + semantic.rank_ix), 0) * semantic_weight AS hybrid_score
FROM
  full_text
  FULL OUTER JOIN semantic
    ON full_text.chunk_id = semantic.chunk_id AND full_text.document_id = semantic.document_id
  JOIN public.document_chunks AS chunks
    ON COALESCE(full_text.chunk_id, semantic.chunk_id) = chunks.id
  JOIN public.documents AS docs ON chunks.document_id = docs.id
  ORDER BY hybrid_score DESC
LIMIT
  least(match_count, 30)
$$;
