CREATE TABLE favorite_documents (
	user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
	registered_document_id INT NOT NULL REFERENCES registered_documents (id) ON DELETE CASCADE
);

ALTER TABLE favorite_documents enable ROW level security;

CREATE POLICY "Allow authenticated users to CRUD their own rows" ON favorite_documents FOR ALL TO authenticated USING (auth.uid () = user_id)
WITH
	CHECK (auth.uid () = user_id);
