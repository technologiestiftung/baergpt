-- TABLE
CREATE TABLE IF NOT EXISTS "public"."access_group_members" (
    "user_id" "uuid" NOT NULL,
    "access_group_id" "uuid" NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" (),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" ()
);

ALTER TABLE "public"."access_group_members" OWNER TO "postgres";

ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_pkey" PRIMARY KEY ("user_id");

-- FOREIGN KEYS
ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "public"."access_groups" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_user_access_group_key" UNIQUE ("user_id", "access_group_id");

-- RLS POLICIES
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
                AND (NOT "public"."is_current_user_banned_or_deleted" ())
            )
        )
    );

CREATE POLICY "access_group_members_update_admin" ON "public"."access_group_members"
FOR UPDATE
    USING ("public"."is_application_admin" ())
WITH
    CHECK ("public"."is_application_admin" ());

GRANT ALL ON TABLE "public"."access_group_members" TO "anon";

GRANT ALL ON TABLE "public"."access_group_members" TO "authenticated";

GRANT ALL ON TABLE "public"."access_group_members" TO "service_role";
