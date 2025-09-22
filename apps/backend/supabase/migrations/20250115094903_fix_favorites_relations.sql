ALTER TABLE favorite_documents
DROP CONSTRAINT favorite_documents_registered_document_id_fkey;

ALTER TABLE favorite_documents
RENAME registered_document_id TO processed_document_id;

ALTER TABLE favorite_documents
ADD CONSTRAINT constraint_name FOREIGN key (processed_document_id) REFERENCES processed_documents (id) ON DELETE CASCADE;
