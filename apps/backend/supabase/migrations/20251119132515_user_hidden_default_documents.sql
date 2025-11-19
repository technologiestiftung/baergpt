CREATE TABLE IF NOT EXISTS user_hidden_default_documents (
	user_id UUID REFERENCES public.profiles (id),
	document_id INT REFERENCES public.documents (id),
	created_at TIMESTAMP DEFAULT NOW(),
	PRIMARY KEY (user_id, document_id)
);

ALTER TABLE user_hidden_default_documents enable ROW level security;

CREATE POLICY "Users can insert their own hidden default docs" ON user_hidden_default_documents FOR insert TO authenticated
WITH
	CHECK (user_id = auth.uid ());

CREATE POLICY "Users can view their own hidden default docs" ON user_hidden_default_documents FOR
SELECT
	TO authenticated USING (user_id = auth.uid ());

CREATE POLICY "Admins can delete hidden default docs" ON user_hidden_default_documents FOR delete TO authenticated USING (public.is_application_admin ());
