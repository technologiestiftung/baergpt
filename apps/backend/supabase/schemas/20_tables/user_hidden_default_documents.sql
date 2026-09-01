CREATE TABLE IF NOT EXISTS "public"."user_hidden_default_documents" (
    "user_id" "uuid" NOT NULL,
    "document_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT "now" ()
);

ALTER TABLE "public"."user_hidden_default_documents" OWNER TO "postgres";

ALTER TABLE ONLY "public"."user_hidden_default_documents"
ADD CONSTRAINT "user_hidden_default_documents_pkey" PRIMARY KEY ("user_id", "document_id");

GRANT ALL ON TABLE "public"."user_hidden_default_documents" TO "anon";

GRANT ALL ON TABLE "public"."user_hidden_default_documents" TO "authenticated";

GRANT ALL ON TABLE "public"."user_hidden_default_documents" TO "service_role";
