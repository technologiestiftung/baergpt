-- Update constraint to allow default_document type with both owned_by_user_id and access_group_id as NULL
-- For documents table
ALTER TABLE documents
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
	OR (
		owned_by_user_id IS NULL
		AND access_group_id IS NULL
		AND source_type = 'default_document'
	)
);

-- For document_chunks table - need to check via document_id join
-- Since we can't directly check source_type in chunks, we'll allow NULL for both
-- when the document has default_document type (enforced at document level)
ALTER TABLE document_chunks
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
	OR (
		owned_by_user_id IS NULL
		AND access_group_id IS NULL
	)
);

-- For document_summaries table
ALTER TABLE document_summaries
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
	OR (
		owned_by_user_id IS NULL
		AND access_group_id IS NULL
	)
);
