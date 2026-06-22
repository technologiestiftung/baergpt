-- Require an active user in all user-facing RLS policies.
--
-- Deactivated users keep a valid JWT and can hit PostgREST/RPC directly,
-- bypassing the backend's active check. RLS is the only gate there, so we add
-- public.is_current_user_active() to each policy.
--
-- Active is paired with the (row-dependent) ownership check. Admin branches use
-- is_application_admin(), which already gates active, so they are not wrapped
-- again. is_current_user_active() / auth.uid() are wrapped in (SELECT ...) to be
-- hoisted once per query. Read policies wrap the whole predicate so the public /
-- base-knowledge branch is gated for inactive users too.
-- 1. chats
DROP POLICY IF EXISTS "Allow authenticated users to CRUD their own chats" ON public.chats;

CREATE POLICY "Allow authenticated users to CRUD their own chats" ON public.chats TO authenticated USING (
    (
        (
            SELECT
                auth.uid ()
        ) = user_id
    )
    AND (
        SELECT
            public.is_current_user_active ()
    )
)
WITH
    CHECK (
        (
            (
                SELECT
                    auth.uid ()
            ) = user_id
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 2. chat_messages
DROP POLICY IF EXISTS "Allow authenticated users to CRUD their own chat_messages" ON public.chat_messages;

CREATE POLICY "Allow authenticated users to CRUD their own chat_messages" ON public.chat_messages TO authenticated USING (
    (
        EXISTS (
            SELECT
                1
            FROM
                public.chats
            WHERE
                (
                    (chats.id = chat_messages.chat_id)
                    AND (
                        chats.user_id = (
                            SELECT
                                auth.uid ()
                        )
                    )
                )
        )
    )
    AND (
        SELECT
            public.is_current_user_active ()
    )
)
WITH
    CHECK (
        (
            EXISTS (
                SELECT
                    1
                FROM
                    public.chats
                WHERE
                    (
                        (chats.id = chat_messages.chat_id)
                        AND (
                            chats.user_id = (
                                SELECT
                                    auth.uid ()
                            )
                        )
                    )
            )
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 3. document_folders
DROP POLICY IF EXISTS "Allow authenticated users to CRUD their own document_folders" ON public.document_folders;

CREATE POLICY "Allow authenticated users to CRUD their own document_folders" ON public.document_folders TO authenticated USING (
    (
        (
            SELECT
                auth.uid ()
        ) = user_id
    )
    AND (
        SELECT
            public.is_current_user_active ()
    )
)
WITH
    CHECK (
        (
            (
                SELECT
                    auth.uid ()
            ) = user_id
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 4. favorite_documents
DROP POLICY IF EXISTS "Allow authenticated users to CRUD their own rows" ON public.favorite_documents;

CREATE POLICY "Allow authenticated users to CRUD their own rows" ON public.favorite_documents TO authenticated USING (
    (
        (
            SELECT
                auth.uid ()
        ) = user_id
    )
    AND (
        SELECT
            public.is_current_user_active ()
    )
)
WITH
    CHECK (
        (
            (
                SELECT
                    auth.uid ()
            ) = user_id
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 5. documents — read (SELECT)
DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON public.documents;

CREATE POLICY "Allow authenticated users to read documents" ON public.documents FOR
SELECT
    TO authenticated USING (
        (
            (owned_by_user_id IS NULL)
            OR (
                owned_by_user_id = (
                    SELECT
                        auth.uid ()
                )
            )
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 6. documents — insert (INSERT)
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON public.documents;

CREATE POLICY "Allow authenticated users to insert documents" ON public.documents FOR INSERT TO authenticated
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND (
                SELECT
                    public.is_current_user_active ()
            )
        )
        OR (
            public.is_application_admin ()
            AND (owned_by_user_id IS NULL)
        )
    );

-- 7. documents — update (UPDATE)
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON public.documents;

CREATE POLICY "Allow authenticated users to update documents" ON public.documents
FOR UPDATE
    TO authenticated USING (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 8. documents — delete (DELETE)
DROP POLICY IF EXISTS "Allow owners to delete documents and admins to delete base know" ON public.documents;

CREATE POLICY "Allow owners to delete documents and admins to delete base know" ON public.documents FOR DELETE TO authenticated USING (
    (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND (
                SELECT
                    public.is_current_user_active ()
            )
        )
        OR (
            public.is_application_admin ()
            AND (owned_by_user_id IS NULL)
        )
    )
    AND (source_type <> 'default_document'::TEXT)
);

-- 9. document_chunks
DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_chun" ON public.document_chunks;

CREATE POLICY "Allow authenticated users to access own or public document_chun" ON public.document_chunks TO authenticated USING (
    (
        (owned_by_user_id IS NULL)
        OR (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
    )
    AND (
        SELECT
            public.is_current_user_active ()
    )
)
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND (
                SELECT
                    public.is_current_user_active ()
            )
        )
        OR (
            public.is_application_admin ()
            AND (owned_by_user_id IS NULL)
        )
    );

-- 10. document_summaries
DROP POLICY IF EXISTS "Allow authenticated users to access own or public document_summ" ON public.document_summaries;

CREATE POLICY "Allow authenticated users to access own or public document_summ" ON public.document_summaries TO authenticated USING (
    (
        (owned_by_user_id IS NULL)
        OR (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
        )
    )
    AND (
        SELECT
            public.is_current_user_active ()
    )
)
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND (
                SELECT
                    public.is_current_user_active ()
            )
        )
        OR (
            public.is_application_admin ()
            AND (owned_by_user_id IS NULL)
        )
    );

-- 11. user_hidden_default_documents — insert (INSERT)
DROP POLICY IF EXISTS "Users can insert their own hidden default docs" ON public.user_hidden_default_documents;

CREATE POLICY "Users can insert their own hidden default docs" ON public.user_hidden_default_documents FOR INSERT TO authenticated
WITH
    CHECK (
        (
            user_id = (
                SELECT
                    auth.uid ()
            )
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 12. user_hidden_default_documents — view (SELECT)
DROP POLICY IF EXISTS "Users can view their own hidden default docs" ON public.user_hidden_default_documents;

CREATE POLICY "Users can view their own hidden default docs" ON public.user_hidden_default_documents FOR
SELECT
    TO authenticated USING (
        (
            user_id = (
                SELECT
                    auth.uid ()
            )
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 13. profiles — update (UPDATE)
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Users can update own profile." ON public.profiles
FOR UPDATE
    USING (
        (
            (
                SELECT
                    auth.uid ()
            ) = id
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 14. profiles — insert (INSERT)
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT
WITH
    CHECK (
        (
            (
                SELECT
                    auth.uid ()
            ) = id
        )
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- Storage (storage.objects): the same direct-JWT path as PostgREST. Gate the
-- 'documents' bucket (ownership) and the 'public_documents' read on active. The
-- admin 'public_documents' write policies already use is_application_admin().
-- 15. documents bucket — select own
DROP POLICY IF EXISTS "Users can only select their own documents." ON storage.objects;

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
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 16. documents bucket — insert own
DROP POLICY IF EXISTS "Authenticated users can upload a new document." ON storage.objects;

CREATE POLICY "Authenticated users can upload a new document." ON storage.objects FOR INSERT
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
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 17. documents bucket — update own
DROP POLICY IF EXISTS "Users can update their own document." ON storage.objects;

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
        AND (
            SELECT
                public.is_current_user_active ()
        )
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
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );

-- 18. documents bucket — delete own
DROP POLICY IF EXISTS "Users can delete objects where their user ID is in the path" ON storage.objects;

CREATE POLICY "Users can delete objects where their user ID is in the path" ON storage.objects FOR DELETE USING (
    bucket_id = 'documents'
    AND owner_id = (
        SELECT
            auth.uid ()
    )::TEXT
    AND (storage.foldername (name)) [1] = (
        SELECT
            auth.uid ()
    )::TEXT
    AND (
        SELECT
            public.is_current_user_active ()
    )
);

-- 19. public_documents bucket — read base knowledge
DROP POLICY IF EXISTS "Users can select all public_documents." ON storage.objects;

CREATE POLICY "Users can select all public_documents." ON storage.objects FOR
SELECT
    USING (
        bucket_id = 'public_documents'
        AND (
            SELECT
                public.is_current_user_active ()
        )
    );
