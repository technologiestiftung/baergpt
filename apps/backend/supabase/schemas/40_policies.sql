CREATE POLICY "Admins can delete hidden default docs" ON "public"."user_hidden_default_documents" FOR DELETE TO "authenticated" USING ("public"."is_application_admin" ());

CREATE POLICY "Allow authenticated users to CRUD their own chat_messages" ON "public"."chat_messages" TO "authenticated" USING (
    (
        (
            EXISTS (
                SELECT
                    1
                FROM
                    "public"."chats"
                WHERE
                    (
                        ("chats"."id" = "chat_messages"."chat_id")
                        AND (
                            "chats"."user_id" = (
                                SELECT
                                    "auth"."uid" () AS "uid"
                            )
                        )
                    )
            )
        )
        AND (NOT "public"."is_current_user_banned" ())
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
                        "public"."chats"
                    WHERE
                        (
                            ("chats"."id" = "chat_messages"."chat_id")
                            AND (
                                "chats"."user_id" = (
                                    SELECT
                                        "auth"."uid" () AS "uid"
                                )
                            )
                        )
                )
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Allow authenticated users to CRUD their own chats" ON "public"."chats" TO "authenticated" USING (
    (
        (
            (
                SELECT
                    "auth"."uid" () AS "uid"
            ) = "user_id"
        )
        AND (NOT "public"."is_current_user_banned" ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "user_id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Allow authenticated users to CRUD their own document_folders" ON "public"."document_folders" TO "authenticated" USING (
    (
        (
            (
                SELECT
                    "auth"."uid" () AS "uid"
            ) = "user_id"
        )
        AND (NOT "public"."is_current_user_banned" ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "user_id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Allow authenticated users to CRUD their own rows" ON "public"."favorite_documents" TO "authenticated" USING (
    (
        (
            (
                SELECT
                    "auth"."uid" () AS "uid"
            ) = "user_id"
        )
        AND (NOT "public"."is_current_user_banned" ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "user_id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Allow authenticated users to access own or public document_chun" ON "public"."document_chunks" TO "authenticated" USING (
    (
        (
            ("owned_by_user_id" IS NULL)
            OR (
                "owned_by_user_id" = (
                    SELECT
                        "auth"."uid" () AS "uid"
                )
            )
        )
        AND (NOT "public"."is_current_user_banned" ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    "owned_by_user_id" = (
                        SELECT
                            "auth"."uid" () AS "uid"
                    )
                )
                AND (NOT "public"."is_current_user_banned" ())
            )
            OR (
                "public"."is_application_admin" ()
                AND ("owned_by_user_id" IS NULL)
            )
        )
    );

CREATE POLICY "Allow authenticated users to access own or public document_summ" ON "public"."document_summaries" TO "authenticated" USING (
    (
        (
            ("owned_by_user_id" IS NULL)
            OR (
                "owned_by_user_id" = (
                    SELECT
                        "auth"."uid" () AS "uid"
                )
            )
        )
        AND (NOT "public"."is_current_user_banned" ())
    )
)
WITH
    CHECK (
        (
            (
                (
                    "owned_by_user_id" = (
                        SELECT
                            "auth"."uid" () AS "uid"
                    )
                )
                AND (NOT "public"."is_current_user_banned" ())
            )
            OR (
                "public"."is_application_admin" ()
                AND ("owned_by_user_id" IS NULL)
            )
        )
    );

CREATE POLICY "Allow authenticated users to access own profile" ON "public"."profiles" FOR
SELECT
    TO "authenticated" USING (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Allow authenticated users to insert documents" ON "public"."documents" FOR INSERT TO "authenticated"
WITH
    CHECK (
        (
            (
                (
                    "owned_by_user_id" = (
                        SELECT
                            "auth"."uid" () AS "uid"
                    )
                )
                AND (NOT "public"."is_current_user_banned" ())
            )
            OR (
                "public"."is_application_admin" ()
                AND ("owned_by_user_id" IS NULL)
            )
        )
    );

CREATE POLICY "Allow authenticated users to read documents" ON "public"."documents" FOR
SELECT
    TO "authenticated" USING (
        (
            (
                ("owned_by_user_id" IS NULL)
                OR (
                    "owned_by_user_id" = (
                        SELECT
                            "auth"."uid" () AS "uid"
                    )
                )
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Allow authenticated users to update documents" ON "public"."documents"
FOR UPDATE
    TO "authenticated" USING (
        (
            (
                "owned_by_user_id" = (
                    SELECT
                        "auth"."uid" () AS "uid"
                )
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Allow owners to delete documents and admins to delete base know" ON "public"."documents" FOR DELETE TO "authenticated" USING (
    (
        (
            (
                (
                    "owned_by_user_id" = (
                        SELECT
                            "auth"."uid" () AS "uid"
                    )
                )
                AND (NOT "public"."is_current_user_banned" ())
            )
            OR (
                "public"."is_application_admin" ()
                AND ("owned_by_user_id" IS NULL)
            )
        )
        AND ("source_type" <> 'default_document'::"text")
    )
);

CREATE POLICY "Users can insert their own hidden default docs" ON "public"."user_hidden_default_documents" FOR INSERT TO "authenticated"
WITH
    CHECK (
        (
            (
                "user_id" = (
                    SELECT
                        "auth"."uid" () AS "uid"
                )
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Users can update own profile." ON "public"."profiles"
FOR UPDATE
    USING (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Users can view their own hidden default docs" ON "public"."user_hidden_default_documents" FOR
SELECT
    TO "authenticated" USING (
        (
            (
                "user_id" = (
                    SELECT
                        "auth"."uid" () AS "uid"
                )
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

ALTER TABLE "public"."access_group_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_group_members_delete_admin" ON "public"."access_group_members" FOR DELETE USING ("public"."is_application_admin" ());

CREATE POLICY "access_group_members_insert_admin" ON "public"."access_group_members" FOR INSERT
WITH
    CHECK ("public"."is_application_admin" ());

CREATE POLICY "access_group_members_select" ON "public"."access_group_members" FOR
SELECT
    USING (
        (
            "public"."is_application_admin" ()
            OR (
                (
                    "user_id" = (
                        SELECT
                            "auth"."uid" () AS "uid"
                    )
                )
                AND (NOT "public"."is_current_user_banned" ())
            )
        )
    );

CREATE POLICY "access_group_members_update_admin" ON "public"."access_group_members"
FOR UPDATE
    USING ("public"."is_application_admin" ())
WITH
    CHECK ("public"."is_application_admin" ());

ALTER TABLE "public"."access_groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "access_groups_delete_admin" ON "public"."access_groups" FOR DELETE USING ("public"."is_application_admin" ());

CREATE POLICY "access_groups_insert_admin" ON "public"."access_groups" FOR INSERT
WITH
    CHECK ("public"."is_application_admin" ());

CREATE POLICY "access_groups_select_all" ON "public"."access_groups" FOR
SELECT
    USING (TRUE);

CREATE POLICY "access_groups_update_admin" ON "public"."access_groups"
FOR UPDATE
    USING ("public"."is_application_admin" ())
WITH
    CHECK ("public"."is_application_admin" ());

ALTER TABLE "public"."allowed_email_domains" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."allowed_individual_emails" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."application_admins" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "application_admins_no_direct_access" ON "public"."application_admins" USING (FALSE)
WITH
    CHECK (FALSE);

ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."document_chunks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."document_folders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."document_summaries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."favorite_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."maintenance_mode" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_hidden_default_documents" ENABLE ROW LEVEL SECURITY;
