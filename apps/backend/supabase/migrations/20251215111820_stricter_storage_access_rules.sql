-- Configure bucket file size limits and allowed mime types
-- 10 MB = 10485760 bytes
UPDATE storage.buckets
SET
	file_size_limit = 10485760,
	allowed_mime_types = ARRAY[
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	]
WHERE
	id = 'documents';

UPDATE storage.buckets
SET
	file_size_limit = 10485760,
	allowed_mime_types = ARRAY[
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	]
WHERE
	id = 'public_documents';

-- Update RLS policies for stricter access control
DROP POLICY "Users can only select their own documents." ON storage.objects;

CREATE POLICY "Users can only select their own documents." ON storage.objects FOR
SELECT
	USING (
		bucket_id = 'documents'
		AND owner_id = (
			SELECT
				auth.uid ()
		)::TEXT
		AND (storage.foldername (name)) [1] = (
			SELECT
				auth.uid ()
		)::TEXT
	);

DROP POLICY "Authenticated users can upload a new document." ON storage.objects;

CREATE POLICY "Authenticated users can upload a new document." ON storage.objects FOR insert
WITH
	CHECK (
		bucket_id = 'documents'
		AND (
			SELECT
				auth.uid ()
		) IS NOT NULL
		AND (storage.foldername (name)) [1] = (
			SELECT
				auth.uid ()
		)::TEXT
	);

DROP POLICY "Users can update their own document." ON storage.objects;

CREATE POLICY "Users can update their own document." ON storage.objects
FOR UPDATE
	USING (
		bucket_id = 'documents'
		AND owner_id = (
			SELECT
				auth.uid ()
		)::TEXT
		AND (storage.foldername (name)) [1] = (
			SELECT
				auth.uid ()
		)::TEXT
	)
WITH
	CHECK (
		bucket_id = 'documents'
		AND owner_id = (
			SELECT
				auth.uid ()
		)::TEXT
		AND (storage.foldername (name)) [1] = (
			SELECT
				auth.uid ()
		)::TEXT
	);

DROP POLICY "Users can delete objects where their user ID is in the path" ON storage.objects;

CREATE POLICY "Users can delete objects where their user ID is in the path" ON storage.objects FOR delete USING (
	bucket_id = 'documents'
	AND owner_id = (
		SELECT
			auth.uid ()
	)::TEXT
	AND (storage.foldername (name)) [1] = (
		SELECT
			auth.uid ()
	)::TEXT
);
