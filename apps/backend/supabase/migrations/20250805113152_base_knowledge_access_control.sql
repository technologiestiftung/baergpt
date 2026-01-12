-- remove foreign key constraints from document tables and make user_id nullable to allow base knowledge documents
ALTER TABLE documents
DROP CONSTRAINT if EXISTS fk_documents_owned_by_user;

ALTER TABLE documents
ALTER COLUMN owned_by_user_id
DROP NOT NULL;

ALTER TABLE document_chunks
DROP CONSTRAINT if EXISTS fk_document_chunks_owned_by_user;

ALTER TABLE document_chunks
ALTER COLUMN owned_by_user_id
DROP NOT NULL;

ALTER TABLE document_summaries
DROP CONSTRAINT if EXISTS fk_document_summaries_owned_by_user;

ALTER TABLE document_summaries
ALTER COLUMN owned_by_user_id
DROP NOT NULL;

-- add access_groups table
CREATE TABLE IF NOT EXISTS access_groups (
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    name TEXT NOT NULL UNIQUE,
    subset_of UUID REFERENCES access_groups (id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- function that stamps the updated_at column
CREATE OR REPLACE FUNCTION tg_set_updated_at () returns trigger
SET
    search_path = '' AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ language plpgsql;

-- trigger that fires on every INSERT or UPDATE
CREATE OR REPLACE TRIGGER auto_set_updated_at_on_access_groups before insert
OR
UPDATE ON access_groups FOR each ROW
EXECUTE procedure tg_set_updated_at ();

-- add access_group_members table
CREATE TABLE IF NOT EXISTS access_group_members (
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE PRIMARY KEY,
    access_group_id UUID NOT NULL REFERENCES access_groups (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- trigger that fires on every INSERT or UPDATE
CREATE OR REPLACE TRIGGER auto_set_updated_at_for_access_group_members before insert
OR
UPDATE ON access_group_members FOR each ROW
EXECUTE procedure tg_set_updated_at ();

-- add access_group_id to document tables and enforce it being set if owned_by_user_id is NULL
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS access_group_id UUID REFERENCES access_groups (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
DROP CONSTRAINT if EXISTS chk_documents_ownership,
ADD CONSTRAINT chk_documents_ownership CHECK (
    (
        owned_by_user_id IS NOT NULL
        AND access_group_id IS NULL
    )
    OR (
        owned_by_user_id IS NULL
        AND access_group_id IS NOT NULL
    )
);

ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS access_group_id UUID REFERENCES access_groups (id) ON DELETE SET NULL,
DROP CONSTRAINT if EXISTS chk_document_chunks_ownership,
ADD CONSTRAINT chk_document_chunks_ownership CHECK (
    (
        owned_by_user_id IS NOT NULL
        AND access_group_id IS NULL
    )
    OR (
        owned_by_user_id IS NULL
        AND access_group_id IS NOT NULL
    )
);

ALTER TABLE document_summaries
ADD COLUMN IF NOT EXISTS access_group_id UUID REFERENCES access_groups (id) ON DELETE SET NULL,
DROP CONSTRAINT if EXISTS chk_document_summaries_ownership,
ADD CONSTRAINT chk_document_summaries_ownership CHECK (
    (
        owned_by_user_id IS NOT NULL
        AND access_group_id IS NULL
    )
    OR (
        owned_by_user_id IS NULL
        AND access_group_id IS NOT NULL
    )
);

-- remove ability to search all documents without a user_id by default
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
      (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
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
      (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
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
