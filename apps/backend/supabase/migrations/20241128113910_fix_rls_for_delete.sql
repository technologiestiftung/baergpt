CREATE POLICY "Users can delete their own document." ON storage.objects FOR delete USING (
    (
        SELECT
            auth.uid ()
    ) = owner
    AND bucket_id = 'documents'
);

CREATE POLICY "Allow authenticated users to delete own registered_documents" ON "public"."registered_documents" FOR delete TO authenticated USING (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to delete own processed_documents" ON "public"."processed_documents" FOR delete TO authenticated USING (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to delete own processed_document_summaries" ON "public"."processed_document_summaries" FOR delete TO authenticated USING (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to delete own processed_document_chunks" ON "public"."processed_document_chunks" FOR delete TO authenticated USING (owned_by_user_id = auth.uid ());
