-- Migration to add proper foreign key constraints for user ownership
-- Clean up orphaned documents if there are any
DELETE FROM documents
WHERE
    owned_by_user_id IS NULL
    OR owned_by_user_id NOT IN (
        SELECT
            id
        FROM
            auth.users
    );

-- Clean up orphaned document_summaries if there are any
DELETE FROM document_summaries
WHERE
    owned_by_user_id IS NULL
    OR owned_by_user_id NOT IN (
        SELECT
            id
        FROM
            auth.users
    );

-- Clean up orphaned document_chunks if there are any
DELETE FROM document_chunks
WHERE
    owned_by_user_id IS NULL
    OR owned_by_user_id NOT IN (
        SELECT
            id
        FROM
            auth.users
    );

ALTER TABLE documents
ALTER COLUMN owned_by_user_id
SET NOT NULL;

-- Add foreign key constraint for documents
ALTER TABLE documents
ADD CONSTRAINT fk_documents_owned_by_user FOREIGN key (owned_by_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE document_summaries
ALTER COLUMN owned_by_user_id
SET NOT NULL;

ALTER TABLE document_summaries
ADD CONSTRAINT fk_document_summaries_owned_by_user FOREIGN key (owned_by_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE document_chunks
ALTER COLUMN owned_by_user_id
SET NOT NULL;

ALTER TABLE document_chunks
ADD CONSTRAINT fk_document_chunks_owned_by_user FOREIGN key (owned_by_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- Add indices for better performance on the foreign key columns
CREATE INDEX if NOT EXISTS idx_documents_owned_by_user_id ON documents (owned_by_user_id);

CREATE INDEX if NOT EXISTS idx_document_summaries_owned_by_user_id ON document_summaries (owned_by_user_id);

CREATE INDEX if NOT EXISTS idx_document_chunks_owned_by_user_id ON document_chunks (owned_by_user_id);

comment ON CONSTRAINT fk_documents_owned_by_user ON documents IS 'Ensures documents are owned by valid users and cascades delete when user is deleted';

comment ON CONSTRAINT fk_document_summaries_owned_by_user ON document_summaries IS 'Ensures document summaries are owned by valid users and cascades delete when user is deleted';

comment ON CONSTRAINT fk_document_chunks_owned_by_user ON document_chunks IS 'Ensures document chunks are owned by valid users and cascades delete when user is deleted';
