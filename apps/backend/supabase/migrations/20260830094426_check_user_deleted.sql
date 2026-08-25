-- auto-generated via `supabase db diff --schema public`
DROP POLICY "access_group_members_select" ON "public"."access_group_members";

DROP POLICY "Allow authenticated users to CRUD their own chat_messages" ON "public"."chat_messages";

DROP POLICY "Allow authenticated users to CRUD their own chats" ON "public"."chats";

DROP POLICY "Allow authenticated users to access own or public document_chun" ON "public"."document_chunks";

DROP POLICY "Allow authenticated users to CRUD their own document_folders" ON "public"."document_folders";

DROP POLICY "Allow authenticated users to access own or public document_summ" ON "public"."document_summaries";

DROP POLICY "Allow authenticated users to insert documents" ON "public"."documents";

DROP POLICY "Allow authenticated users to read documents" ON "public"."documents";

DROP POLICY "Allow authenticated users to update documents" ON "public"."documents";

DROP POLICY "Allow owners to delete documents and admins to delete base know" ON "public"."documents";

DROP POLICY "Allow authenticated users to CRUD their own rows" ON "public"."favorite_documents";

DROP POLICY "Allow authenticated users to access own profile" ON "public"."profiles";

DROP POLICY "Users can insert their own profile." ON "public"."profiles";

DROP POLICY "Users can update own profile." ON "public"."profiles";

DROP POLICY "Users can insert their own hidden default docs" ON "public"."user_hidden_default_documents";

DROP POLICY "Users can view their own hidden default docs" ON "public"."user_hidden_default_documents";

DROP POLICY "Authenticated users can upload a new document." ON "storage"."objects";

DROP POLICY "Users can only select their own documents." ON "storage"."objects";

DROP POLICY "Users can update their own document." ON "storage"."objects";

DROP POLICY "Users can delete objects where their user ID is in the path" ON "storage"."objects";

DROP FUNCTION if EXISTS "public"."is_current_user_banned" ();

SET
    check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_current_user_banned_or_deleted () RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER
SET
    search_path TO '' AS $function$
SELECT
  -- Treat a deleted user (valid pre-deletion session, but no row) as banned
  NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
  )
  OR EXISTS (
                    SELECT 1
                    FROM auth.users u
                    WHERE u.id = auth.uid()
                      AND u.banned_until IS NOT NULL
                      AND u.banned_until > now()
                );
$function$;

CREATE OR REPLACE FUNCTION public.delete_user () RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path TO ''
SET
    statement_timeout TO '60000' AS $function$
BEGIN
    IF public.is_current_user_banned_or_deleted() THEN
        RAISE EXCEPTION 'Permission denied: banned or deleted users may not delete their account';
END IF;

DELETE FROM auth.users WHERE id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_application_admin () RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER
SET
    search_path TO '' AS $function$
SELECT
    EXISTS (SELECT 1 FROM public.application_admins WHERE user_id = auth.uid())
    AND NOT (SELECT public.is_current_user_banned_or_deleted());
$function$;

CREATE POLICY "access_group_members_select" ON "public"."access_group_members" AS permissive FOR
SELECT
    TO public USING (
        (
            public.is_application_admin ()
            OR (
                (
                    user_id = (
                        SELECT
                            auth.uid () AS uid
                    )
                )
                AND (NOT public.is_current_user_banned_or_deleted ())
            )
        )
    );

CREATE POLICY "Allow authenticated users to CRUD their own chat_messages" ON "public"."chat_messages" AS permissive FOR ALL TO authenticated USING (
    (
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
                                    auth.uid () AS uid
                            )
                        )
                    )
            )
        )
        AND (NOT public.is_current_user_banned_or_deleted ())
    )
)
WITH
    CHECK (
        (
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
                                        auth.uid () AS uid
                                )
                            )
                        )
                )
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Allow authenticated users to CRUD their own chats" ON "public"."chats" AS permissive FOR ALL TO authenticated USING (
    (
        (
            (
                SELECT
                    auth.uid () AS uid
            ) = user_id
        )
        AND (NOT public.is_current_user_banned_or_deleted ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        auth.uid () AS uid
                ) = user_id
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Allow authenticated users to access own or public document_chun" ON "public"."document_chunks" AS permissive FOR ALL TO authenticated USING (
    (
        (
            (owned_by_user_id IS NULL)
            OR (
                owned_by_user_id = (
                    SELECT
                        auth.uid () AS uid
                )
            )
        )
        AND (NOT public.is_current_user_banned_or_deleted ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    owned_by_user_id = (
                        SELECT
                            auth.uid () AS uid
                    )
                )
                AND (NOT public.is_current_user_banned_or_deleted ())
            )
            OR (
                public.is_application_admin ()
                AND (owned_by_user_id IS NULL)
            )
        )
    );

CREATE POLICY "Allow authenticated users to CRUD their own document_folders" ON "public"."document_folders" AS permissive FOR ALL TO authenticated USING (
    (
        (
            (
                SELECT
                    auth.uid () AS uid
            ) = user_id
        )
        AND (NOT public.is_current_user_banned_or_deleted ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        auth.uid () AS uid
                ) = user_id
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Allow authenticated users to access own or public document_summ" ON "public"."document_summaries" AS permissive FOR ALL TO authenticated USING (
    (
        (
            (owned_by_user_id IS NULL)
            OR (
                owned_by_user_id = (
                    SELECT
                        auth.uid () AS uid
                )
            )
        )
        AND (NOT public.is_current_user_banned_or_deleted ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    owned_by_user_id = (
                        SELECT
                            auth.uid () AS uid
                    )
                )
                AND (NOT public.is_current_user_banned_or_deleted ())
            )
            OR (
                public.is_application_admin ()
                AND (owned_by_user_id IS NULL)
            )
        )
    );

CREATE POLICY "Allow authenticated users to insert documents" ON "public"."documents" AS permissive FOR insert TO authenticated
WITH
    CHECK (
        (
            (
                (
                    owned_by_user_id = (
                        SELECT
                            auth.uid () AS uid
                    )
                )
                AND (NOT public.is_current_user_banned_or_deleted ())
            )
            OR (
                public.is_application_admin ()
                AND (owned_by_user_id IS NULL)
            )
        )
    );

CREATE POLICY "Allow authenticated users to read documents" ON "public"."documents" AS permissive FOR
SELECT
    TO authenticated USING (
        (
            (
                (owned_by_user_id IS NULL)
                OR (
                    owned_by_user_id = (
                        SELECT
                            auth.uid () AS uid
                    )
                )
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Allow authenticated users to update documents" ON "public"."documents" AS permissive
FOR UPDATE
    TO authenticated USING (
        (
            (
                owned_by_user_id = (
                    SELECT
                        auth.uid () AS uid
                )
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Allow owners to delete documents and admins to delete base know" ON "public"."documents" AS permissive FOR delete TO authenticated USING (
    (
        (
            (
                (
                    owned_by_user_id = (
                        SELECT
                            auth.uid () AS uid
                    )
                )
                AND (NOT public.is_current_user_banned_or_deleted ())
            )
            OR (
                public.is_application_admin ()
                AND (owned_by_user_id IS NULL)
            )
        )
        AND (source_type <> 'default_document'::TEXT)
    )
);

CREATE POLICY "Allow authenticated users to CRUD their own rows" ON "public"."favorite_documents" AS permissive FOR ALL TO authenticated USING (
    (
        (
            (
                SELECT
                    auth.uid () AS uid
            ) = user_id
        )
        AND (NOT public.is_current_user_banned_or_deleted ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        auth.uid () AS uid
                ) = user_id
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Allow authenticated users to access own profile" ON "public"."profiles" AS permissive FOR
SELECT
    TO authenticated USING (
        (
            (
                (
                    SELECT
                        auth.uid () AS uid
                ) = id
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Users can insert their own profile." ON "public"."profiles" AS permissive FOR insert TO public
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        auth.uid () AS uid
                ) = id
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Users can update own profile." ON "public"."profiles" AS permissive
FOR UPDATE
    TO public USING (
        (
            (
                (
                    SELECT
                        auth.uid () AS uid
                ) = id
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Users can insert their own hidden default docs" ON "public"."user_hidden_default_documents" AS permissive FOR insert TO authenticated
WITH
    CHECK (
        (
            (
                user_id = (
                    SELECT
                        auth.uid () AS uid
                )
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

CREATE POLICY "Users can view their own hidden default docs" ON "public"."user_hidden_default_documents" AS permissive FOR
SELECT
    TO authenticated USING (
        (
            (
                user_id = (
                    SELECT
                        auth.uid () AS uid
                )
            )
            AND (NOT public.is_current_user_banned_or_deleted ())
        )
    );

-- manually written to cover schemas not covered by `supabase db diff --schema public` (e.g. storage)
CREATE POLICY "Authenticated users can upload a new document." ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
WITH
    CHECK (
        bucket_id = 'documents'
        AND (storage.foldername (name)) [1] = (
            SELECT
                auth.uid ()
        )::TEXT
        AND NOT public.is_current_user_banned_or_deleted ()
    );

CREATE POLICY "Users can only select their own documents." ON storage.objects AS PERMISSIVE FOR
SELECT
    TO authenticated USING (
        bucket_id = 'documents'
        AND owner_id = (
            SELECT
                auth.uid ()
        )::TEXT
        AND (storage.foldername (name)) [1] = (
            SELECT
                auth.uid ()
        )::TEXT
        AND NOT public.is_current_user_banned_or_deleted ()
    );

CREATE POLICY "Users can update their own document." ON storage.objects AS PERMISSIVE
FOR UPDATE
    TO authenticated USING (
        bucket_id = 'documents'
        AND owner_id = (
            SELECT
                auth.uid ()
        )::TEXT
        AND (storage.foldername (name)) [1] = (
            SELECT
                auth.uid ()
        )::TEXT
        AND NOT public.is_current_user_banned_or_deleted ()
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
        AND NOT public.is_current_user_banned_or_deleted ()
    );

CREATE POLICY "Users can delete objects where their user ID is in the path" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (
    bucket_id = 'documents'
    AND owner_id = (
        SELECT
            auth.uid ()
    )::TEXT
    AND (storage.foldername (name)) [1] = (
        SELECT
            auth.uid ()
    )::TEXT
    AND NOT public.is_current_user_banned_or_deleted ()
);
