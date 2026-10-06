-- TABLE
CREATE TABLE IF NOT EXISTS "public"."document_folders" (
    "id" INTEGER NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."document_folders" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."document_folders_id_seq" AS INTEGER START
WITH
    1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "public"."document_folders_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."document_folders_id_seq" OWNED BY "public"."document_folders"."id";

ALTER TABLE ONLY "public"."document_folders"
ALTER COLUMN "id"
SET DEFAULT "nextval" ('"public"."document_folders_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."document_folders"
ADD CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id");

-- FOREIGN KEYS
ALTER TABLE ONLY "public"."document_folders"
ADD CONSTRAINT "document_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

-- RLS POLICIES
ALTER TABLE "public"."document_folders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to CRUD their own document_folders" ON "public"."document_folders" TO "authenticated" USING (
    (
        (
            (
                SELECT
                    "auth"."uid" () AS "uid"
            ) = "user_id"
        )
        AND (NOT "public"."is_current_user_banned_or_deleted" ())
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
            AND (NOT "public"."is_current_user_banned_or_deleted" ())
        )
    );

GRANT ALL ON TABLE "public"."document_folders" TO "anon";

GRANT ALL ON TABLE "public"."document_folders" TO "authenticated";

GRANT ALL ON TABLE "public"."document_folders" TO "service_role";

GRANT ALL ON SEQUENCE "public"."document_folders_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."document_folders_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."document_folders_id_seq" TO "service_role";
