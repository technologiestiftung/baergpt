ALTER TABLE document_chunks
DROP COLUMN IF EXISTS embedding_temp,
DROP COLUMN IF EXISTS content_temp,
DROP COLUMN IF EXISTS embedding;

ALTER TABLE document_summaries
DROP COLUMN IF EXISTS summary_embedding_temp,
DROP COLUMN IF EXISTS summary_temp,
DROP COLUMN IF EXISTS tags_temp,
DROP COLUMN IF EXISTS summary_embedding;
