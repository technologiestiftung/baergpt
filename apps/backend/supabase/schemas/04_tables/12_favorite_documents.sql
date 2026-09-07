-- TABLE
CREATE TABLE IF NOT EXISTS "public"."favorite_documents" ("user_id" "uuid" NOT NULL, "processed_document_id" INTEGER NOT NULL);

ALTER TABLE "public"."favorite_documents" OWNER TO "postgres";

-- FOREIGN KEYS
ALTER TABLE ONLY "public"."favorite_documents"
ADD CONSTRAINT "favorite_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

-- RLS POLICIES
ALTER TABLE "public"."favorite_documents" ENABLE ROW LEVEL SECURITY;

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

GRANT ALL ON TABLE "public"."favorite_documents" TO "anon";

GRANT ALL ON TABLE "public"."favorite_documents" TO "authenticated";

GRANT ALL ON TABLE "public"."favorite_documents" TO "service_role";
