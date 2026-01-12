-- Set up Storage!
INSERT INTO
    storage.buckets (id, name)
VALUES
    ('documents', 'documents');

CREATE POLICY "Users can only select their own documents." ON storage.objects FOR
SELECT
    USING (
        (
            SELECT
                auth.uid ()
        ) = owner
        AND bucket_id = 'documents'
    );

CREATE POLICY "Authenticated users can upload a new document." ON storage.objects FOR insert
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) IS NOT NULL
        AND bucket_id = 'documents'
    );

CREATE POLICY "Users can update their own document." ON storage.objects
FOR UPDATE
    USING (
        (
            SELECT
                auth.uid ()
        ) = owner
    )
WITH
    CHECK (bucket_id = 'documents');
