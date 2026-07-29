DROP POLICY "Users can only select their own documents." ON storage.objects;

CREATE POLICY "Users can only select their own documents." ON storage.objects FOR
SELECT
    USING (
        bucket_id = 'documents'
        AND name LIKE '%' || auth.uid () || '%'
    );
