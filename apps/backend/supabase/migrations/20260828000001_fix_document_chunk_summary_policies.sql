-- Split the FOR ALL policies on document_chunks and document_summaries into
-- per-command policies. PostgreSQL applies only USING to DELETE and to UPDATE
-- row selection, and the FOR ALL USING admitted every base-knowledge row
-- (owned_by_user_id IS NULL), so any authenticated user could delete or
-- rewrite the shared RAG corpus.
--
-- Some environments were patched by hand with the per-command policy names
-- below, so every name is dropped first and the migration converges either way.
-- ── document_chunks ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_chun" ON public.document_chunks;

DROP POLICY IF EXISTS "Allow users to read own or public document_chunks" ON public.document_chunks;

DROP POLICY IF EXISTS "Allow users to insert own; admins public document_chunks" ON public.document_chunks;

DROP POLICY IF EXISTS "Allow users to update own; admins public document_chunks" ON public.document_chunks;

DROP POLICY IF EXISTS "Allow users to delete own; admins public document_chunks" ON public.document_chunks;

CREATE POLICY "Allow users to read own or public document_chunks" ON public.document_chunks FOR
SELECT
    TO authenticated USING (
        (
            owned_by_user_id IS NULL
            OR owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
        AND NOT public.is_current_user_banned ()
    );

CREATE POLICY "Allow users to insert own; admins public document_chunks" ON public.document_chunks FOR insert TO authenticated
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );

CREATE POLICY "Allow users to update own; admins public document_chunks" ON public.document_chunks
FOR UPDATE
    TO authenticated USING (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    )
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );

CREATE POLICY "Allow users to delete own; admins public document_chunks" ON public.document_chunks FOR delete TO authenticated USING (
    (
        owned_by_user_id = (
            SELECT
                auth.uid ()
        )
        AND NOT public.is_current_user_banned ()
    )
    OR (
        public.is_application_admin ()
        AND owned_by_user_id IS NULL
    )
);

-- ── document_summaries ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_summ" ON public.document_summaries;

DROP POLICY IF EXISTS "Allow users to read own or public document_summaries" ON public.document_summaries;

DROP POLICY IF EXISTS "Allow users to insert own; admins public document_summaries" ON public.document_summaries;

DROP POLICY IF EXISTS "Allow users to update own; admins public document_summaries" ON public.document_summaries;

DROP POLICY IF EXISTS "Allow users to delete own; admins public document_summaries" ON public.document_summaries;

CREATE POLICY "Allow users to read own or public document_summaries" ON public.document_summaries FOR
SELECT
    TO authenticated USING (
        (
            owned_by_user_id IS NULL
            OR owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
        AND NOT public.is_current_user_banned ()
    );

CREATE POLICY "Allow users to insert own; admins public document_summaries" ON public.document_summaries FOR insert TO authenticated
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );

CREATE POLICY "Allow users to update own; admins public document_summaries" ON public.document_summaries
FOR UPDATE
    TO authenticated USING (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    )
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );

CREATE POLICY "Allow users to delete own; admins public document_summaries" ON public.document_summaries FOR delete TO authenticated USING (
    (
        owned_by_user_id = (
            SELECT
                auth.uid ()
        )
        AND NOT public.is_current_user_banned ()
    )
    OR (
        public.is_application_admin ()
        AND owned_by_user_id IS NULL
    )
);
