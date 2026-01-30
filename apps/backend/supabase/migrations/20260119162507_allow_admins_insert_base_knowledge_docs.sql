DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON public.documents;

CREATE POLICY "Allow authenticated users to insert documents" ON public.documents FOR INSERT TO authenticated
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );

DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_summ" ON public.document_summaries;

CREATE POLICY "Allow authenticated users to access own or public document_summ" ON public.document_summaries TO authenticated USING (
    (owned_by_user_id IS NULL)
    OR (
        owned_by_user_id = (
            SELECT
                auth.uid ()
        )
    )
)
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );

DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_chun" ON public.document_chunks;

CREATE POLICY "Allow authenticated users to access own or public document_chun" ON public.document_chunks TO authenticated USING (
    (owned_by_user_id IS NULL)
    OR (
        owned_by_user_id = (
            SELECT
                auth.uid ()
        )
    )
)
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );
