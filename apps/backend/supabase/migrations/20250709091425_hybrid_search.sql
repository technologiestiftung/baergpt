ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS full_text_search tsvector generated always AS (TO_TSVECTOR('german', content)) stored;

-- Create an index for the full-text search
CREATE INDEX idx_document_chunks_full_text_search ON document_chunks USING gin (full_text_search);

-- Create an index for the semantic vector search
CREATE INDEX idx_document_chunks_semantic_vector_search ON document_chunks USING hnsw (chunk_jina_embedding vector_cosine_ops);

-- Create hybrid search function for documents using chunks
CREATE OR REPLACE FUNCTION hybrid_chunk_search (
	query_text TEXT,
	query_embedding vector (1024),
	match_count INT,
	allowed_document_ids INTEGER[] DEFAULT NULL,
	allowed_folder_ids INTEGER[] DEFAULT NULL,
	full_text_weight FLOAT = 1,
	semantic_weight FLOAT = 1,
	rrf_k INT = 50
) returns TABLE (
	id INTEGER,
	document_id INTEGER,
	chunk_content TEXT,
	fts_score REAL,
	sem_score REAL,
	hybrid_score REAL
) language sql AS $$
WITH full_text AS (
  SELECT
    id,
    document_id,
    ts_rank_cd(full_text_search,
                 replace(plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery, 32) AS fts_score,
    row_number() over(order BY ts_rank_cd(full_text_search, replace(plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery) desc) AS rank_ix
  FROM
    document_chunks
  WHERE
    full_text_search @@ replace(plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery
    AND (
      owned_by_user_id IS NULL
      OR (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
      OR (allowed_folder_ids IS NOT NULL AND folder_id = any(allowed_folder_ids))
    )
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
),
semantic AS (
  SELECT
    id,
    document_id,
    1 - (chunk_jina_embedding <=> query_embedding) AS sem_score, -- cosine similarity
    row_number() over (ORDER BY chunk_jina_embedding <=> query_embedding) AS rank_ix -- using cosine distance
  FROM
    document_chunks
  WHERE
    chunk_jina_embedding IS NOT NULL
    AND (
      owned_by_user_id IS NULL
      OR (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
      OR (allowed_folder_ids IS NOT NULL AND folder_id = any(allowed_folder_ids))
    )
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
)
SELECT
  document_chunks.id, 
  document_chunks.document_id,
  document_chunks.content AS chunk_content,
  full_text.fts_score,
  semantic.sem_score,
  COALESCE(1.0/(rrf_k + full_text.rank_ix), 0) * full_text_weight + 
  COALESCE(1.0/(rrf_k + semantic.rank_ix), 0) * semantic_weight AS hybrid_score
FROM
  full_text
  FULL OUTER JOIN semantic
    ON full_text.id = semantic.id AND full_text.document_id = semantic.document_id
  JOIN document_chunks
    ON coalesce(full_text.id, semantic.id) = document_chunks.id 
  ORDER BY hybrid_score DESC
LIMIT
  least(match_count, 30)
$$;
