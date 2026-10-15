DROP POLICY "Allow authenticated users to access own or public document_chun" ON "public"."document_chunks";

DROP POLICY "Allow authenticated users to access own or public document_summ" ON "public"."document_summaries";

CREATE POLICY "Allow users to delete own; admins public document_chunks" ON "public"."document_chunks" AS permissive FOR delete TO authenticated USING (
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

CREATE POLICY "Allow users to insert own; admins public document_chunks" ON "public"."document_chunks" AS permissive FOR insert TO authenticated
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

CREATE POLICY "Allow users to read own or public document_chunks" ON "public"."document_chunks" AS permissive FOR
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

CREATE POLICY "Allow users to update own; admins public document_chunks" ON "public"."document_chunks" AS permissive
FOR UPDATE
    TO authenticated USING (
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

CREATE POLICY "Allow users to delete own; admins public document_summaries" ON "public"."document_summaries" AS permissive FOR delete TO authenticated USING (
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

CREATE POLICY "Allow users to insert own; admins public document_summaries" ON "public"."document_summaries" AS permissive FOR insert TO authenticated
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

CREATE POLICY "Allow users to read own or public document_summaries" ON "public"."document_summaries" AS permissive FOR
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

CREATE POLICY "Allow users to update own; admins public document_summaries" ON "public"."document_summaries" AS permissive
FOR UPDATE
    TO authenticated USING (
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
