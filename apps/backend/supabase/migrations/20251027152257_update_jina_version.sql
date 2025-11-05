ALTER TABLE document_chunks
ALTER COLUMN chunk_jina_embeddings
SET DATA TYPE vector (2048);

ALTER TABLE document_summaries
ALTER COLUMN summary_jina_embeddings
SET DATA TYPE vector (2048);
