DROP POLICY "Users can delete their own document." ON storage.objects;

CREATE POLICY "Users can delete objects where their user ID is in the path" ON storage.objects FOR delete USING (
    POSITION(auth.uid ()::TEXT IN name) > 0
    AND bucket_id = 'documents'
);
