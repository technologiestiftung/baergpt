-- Consolidate duplicate policies to fix Multiple Permissive Policies warnings
-- This migration consolidates multiple policies into single, unified policies
-- Fix profiles table - consolidate duplicate SELECT policies
DROP POLICY if EXISTS "Users can select their own profile." ON profiles;

DROP POLICY if EXISTS "Allow authenticated users to access profiles" ON profiles;

CREATE POLICY "Allow authenticated users to access own profile" ON profiles FOR
SELECT
    TO authenticated USING (
        (
            (
                SELECT
                    auth.uid ()
            ) = id
        )
        AND (deleted_at IS NULL)
    );

-- Fix document_chunks - consolidate duplicate policies
DROP POLICY if EXISTS "Allow authenticated users to delete document_chunks" ON document_chunks;

DROP POLICY if EXISTS "Allow authenticated users to delete own processed_document_chun" ON document_chunks;

DROP POLICY if EXISTS "Allow authenticated users to insert document_chunks" ON document_chunks;

DROP POLICY if EXISTS "Allow authenticated users to insert own processed_document_chun" ON document_chunks;

DROP POLICY if EXISTS "Allow authenticated users to read document_chunks" ON document_chunks;

DROP POLICY if EXISTS "Allow authenticated users to read own or public processed_docum" ON document_chunks;

DROP POLICY if EXISTS "Allow authenticated users to update document_chunks" ON document_chunks;

DROP POLICY if EXISTS "Allow authenticated users to update own processed_document_chun" ON document_chunks;

CREATE POLICY "Allow authenticated users to access own or public document_chunks" ON document_chunks FOR ALL TO authenticated USING (
    owned_by_user_id IS NULL
    OR owned_by_user_id = (
        SELECT
            auth.uid ()
    )
)
WITH
    CHECK (
        owned_by_user_id = (
            SELECT
                auth.uid ()
        )
    );

-- Fix document_summaries - consolidate duplicate policies
DROP POLICY if EXISTS "Allow authenticated users to read own or public processed_document_summaries" ON document_summaries;

DROP POLICY if EXISTS "Allow authenticated users to insert own processed_document_summaries" ON document_summaries;

DROP POLICY if EXISTS "Allow authenticated users to update own processed_document_summaries" ON document_summaries;

DROP POLICY if EXISTS "Allow authenticated users to delete own processed_document_summaries" ON document_summaries;

DROP POLICY if EXISTS "Allow authenticated users to read document_summaries" ON document_summaries;

DROP POLICY if EXISTS "Allow authenticated users to insert document_summaries" ON document_summaries;

DROP POLICY if EXISTS "Allow authenticated users to update document_summaries" ON document_summaries;

DROP POLICY if EXISTS "Allow authenticated users to delete document_summaries" ON document_summaries;

CREATE POLICY "Allow authenticated users to access own or public document_summaries" ON document_summaries FOR ALL TO authenticated USING (
    owned_by_user_id IS NULL
    OR owned_by_user_id = (
        SELECT
            auth.uid ()
    )
)
WITH
    CHECK (
        owned_by_user_id = (
            SELECT
                auth.uid ()
        )
    );
