ALTER TABLE "public"."processed_document_chunks" enable ROW level security;

ALTER TABLE "public"."processed_document_summaries" enable ROW level security;

ALTER TABLE "public"."processed_documents" enable ROW level security;

ALTER TABLE "public"."registered_documents" enable ROW level security;

CREATE POLICY "Allow authenticated users to read own or public processed_document_summaries" ON "public"."processed_document_summaries" FOR
SELECT
	TO authenticated USING (
		owned_by_user_id IS NULL
		OR owned_by_user_id = auth.uid ()
	);

CREATE POLICY "Allow authenticated users to read own or public processed_documents" ON "public"."processed_documents" FOR
SELECT
	TO authenticated USING (
		owned_by_user_id IS NULL
		OR owned_by_user_id = auth.uid ()
	);

CREATE POLICY "Allow authenticated users to read own or public registered_documents" ON "public"."registered_documents" FOR
SELECT
	TO authenticated USING (
		owned_by_user_id IS NULL
		OR owned_by_user_id = auth.uid ()
	);

CREATE POLICY "Allow authenticated users to insert own processed_document_summaries" ON "public"."processed_document_summaries" FOR insert TO authenticated
WITH
	CHECK (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to insert own processed_documents" ON "public"."processed_documents" FOR insert TO authenticated
WITH
	CHECK (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to insert own registered_documents" ON "public"."registered_documents" FOR insert TO authenticated
WITH
	CHECK (owned_by_user_id = auth.uid ());
