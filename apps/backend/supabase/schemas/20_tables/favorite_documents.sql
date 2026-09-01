CREATE TABLE IF NOT EXISTS "public"."favorite_documents" ("user_id" "uuid" NOT NULL, "processed_document_id" INTEGER NOT NULL);

ALTER TABLE "public"."favorite_documents" OWNER TO "postgres";

GRANT ALL ON TABLE "public"."favorite_documents" TO "anon";

GRANT ALL ON TABLE "public"."favorite_documents" TO "authenticated";

GRANT ALL ON TABLE "public"."favorite_documents" TO "service_role";
