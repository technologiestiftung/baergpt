CREATE OR REPLACE FUNCTION public.handle_document_deletion () returns trigger language plpgsql security definer
SET
	search_path = '' AS $$
DECLARE
    file_path TEXT;
    pdf_file_path TEXT;
BEGIN
    file_path := OLD.source_url;
    
    IF file_path IS NOT NULL AND file_path != '' THEN
        -- Delete the main file from storage
        DELETE FROM storage.objects 
        WHERE bucket_id = 'documents' AND name = file_path;
        
        -- If the file is a DOCX, also delete the PDF preview version
        IF LOWER(file_path) LIKE '%.docx' THEN
            pdf_file_path := pg_catalog.REGEXP_REPLACE(file_path, '\.docx$', '.pdf', 'i');
            DELETE FROM storage.objects 
            WHERE bucket_id = 'documents' AND name = pdf_file_path;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$;

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
	id INTEGER,
	document_id INTEGER,
	chunk_content TEXT,
	fts_score REAL,
	sem_score REAL,
	hybrid_score REAL
) language sql
SET
	search_path = 'extensions' AS $$
WITH full_text AS (
  SELECT
    id,
    document_id,
    pg_catalog.ts_rank_cd(full_text_search,
                 pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery, 32) AS fts_score,
    pg_catalog.row_number() over(order BY pg_catalog.ts_rank_cd(full_text_search, pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery) desc) AS rank_ix
  FROM
    public.document_chunks
  WHERE
    full_text_search @@ pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery
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
    pg_catalog.row_number() over (ORDER BY chunk_jina_embedding <=> query_embedding) AS rank_ix -- using cosine distance
  FROM
    public.document_chunks
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
  public.document_chunks.id, 
  public.document_chunks.document_id,
  public.document_chunks.content AS chunk_content,
  full_text.fts_score,
  semantic.sem_score,
  COALESCE(1.0/(rrf_k + full_text.rank_ix), 0) * full_text_weight + 
  COALESCE(1.0/(rrf_k + semantic.rank_ix), 0) * semantic_weight AS hybrid_score
FROM
  full_text
  FULL OUTER JOIN semantic
    ON full_text.id = semantic.id AND full_text.document_id = semantic.document_id
  JOIN public.document_chunks
    ON COALESCE(full_text.id, semantic.id) = public.document_chunks.id 
  ORDER BY hybrid_score DESC
LIMIT
  least(match_count, 30)
$$;
