CREATE POLICY "Allow authenticated users to read own or public processed_document_chunks" ON "public"."processed_document_chunks" FOR
SELECT
	TO authenticated USING (
		owned_by_user_id IS NULL
		OR owned_by_user_id = auth.uid ()
	);
