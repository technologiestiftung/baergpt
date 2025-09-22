CREATE POLICY "Allow authenticated users to update own processed_document_summaries" ON "public"."processed_document_summaries"
FOR UPDATE
	TO authenticated USING (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to update own processed_documents" ON "public"."processed_documents"
FOR UPDATE
	TO authenticated USING (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to update own registered_documents" ON "public"."registered_documents"
FOR UPDATE
	TO authenticated USING (owned_by_user_id = auth.uid ());
