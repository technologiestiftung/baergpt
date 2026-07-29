-- Set up Storage!
INSERT INTO
    storage.buckets (id, name)
VALUES
    ('public_documents', 'public_documents');

CREATE POLICY "Users can select all public_documents." ON storage.objects FOR
SELECT
    USING (bucket_id = 'public_documents');
