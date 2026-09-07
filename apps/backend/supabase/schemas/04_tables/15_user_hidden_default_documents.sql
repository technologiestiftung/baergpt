-- TABLE

CREATE TABLE IF NOT EXISTS "public"."user_hidden_default_documents" (
    "user_id" "uuid" NOT NULL,
    "document_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT "now" ()
);

ALTER TABLE "public"."user_hidden_default_documents" OWNER TO "postgres";

ALTER TABLE ONLY "public"."user_hidden_default_documents"
ADD CONSTRAINT "user_hidden_default_documents_pkey" PRIMARY KEY ("user_id", "document_id");

-- FOREIGN KEYS

ALTER TABLE ONLY "public"."user_hidden_default_documents"
ADD CONSTRAINT "user_hidden_default_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents" ("id");

ALTER TABLE ONLY "public"."user_hidden_default_documents"
ADD CONSTRAINT "user_hidden_default_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles" ("id") ON DELETE CASCADE;

-- RLS POLICIES

ALTER TABLE "public"."user_hidden_default_documents" ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Admins can delete hidden default docs" ON "public"."user_hidden_default_documents" FOR DELETE TO "authenticated" USING ("public"."is_application_admin" ());

GRANT ALL ON TABLE "public"."user_hidden_default_documents" TO "anon";

GRANT ALL ON TABLE "public"."user_hidden_default_documents" TO "authenticated";

GRANT ALL ON TABLE "public"."user_hidden_default_documents" TO "service_role";
