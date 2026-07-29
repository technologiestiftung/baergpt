CREATE TABLE document_folders (
    id serial PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL
);

ALTER TABLE document_folders enable ROW level security;

CREATE POLICY "Allow authenticated users to CRUD their own document_folders" ON document_folders FOR ALL TO authenticated USING (auth.uid () = user_id)
WITH
    CHECK (auth.uid () = user_id);

ALTER TABLE registered_documents
ADD COLUMN folder_id INT NULL REFERENCES document_folders (id) ON DELETE CASCADE;

DROP FUNCTION if EXISTS public.find_unprocessed_registered_documents ();

CREATE OR REPLACE FUNCTION public.find_unprocessed_registered_documents () returns TABLE (
    id INTEGER,
    owned_by_user_id UUID,
    source_url TEXT,
    source_type TEXT,
    registered_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    filename TEXT,
    folder_id INTEGER
) language plpgsql AS $function$
BEGIN
RETURN query
SELECT registered_documents.* FROM registered_documents FULL OUTER JOIN processed_documents ON registered_documents.id = processed_documents.registered_document_id WHERE registered_document_id IS NULL;
END;
$function$
