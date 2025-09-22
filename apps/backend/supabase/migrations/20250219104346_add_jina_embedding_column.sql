ALTER TABLE processed_document_summaries
ADD COLUMN summary_jina_embedding vector (1024);

ALTER TABLE processed_document_summaries
ALTER COLUMN summary_embedding
DROP NOT NULL;

ALTER TABLE processed_document_chunks
ADD COLUMN chunk_jina_embedding vector (1024);

ALTER TABLE processed_document_chunks
ALTER COLUMN embedding
DROP NOT NULL;
