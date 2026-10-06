-- TABLE
CREATE TABLE IF NOT EXISTS "public"."access_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid" () NOT NULL,
    "name" "text" NOT NULL,
    "subset_of" "uuid",
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" (),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" ()
);

ALTER TABLE "public"."access_groups" OWNER TO "postgres";

ALTER TABLE ONLY "public"."access_groups"
ADD CONSTRAINT "access_groups_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."access_groups"
ADD CONSTRAINT "access_groups_pkey" PRIMARY KEY ("id");

-- FOREIGN KEYS
ALTER TABLE ONLY "public"."access_groups"
ADD CONSTRAINT "access_groups_subset_of_fkey" FOREIGN KEY ("subset_of") REFERENCES "public"."access_groups" ("id");

-- RLS POLICIES
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

GRANT ALL ON TABLE "public"."access_groups" TO "anon";

GRANT ALL ON TABLE "public"."access_groups" TO "authenticated";

GRANT ALL ON TABLE "public"."access_groups" TO "service_role";
