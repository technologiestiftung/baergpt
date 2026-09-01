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

CREATE OR REPLACE TRIGGER "trg_maintain_chat_messages_folder_references"
BEFORE DELETE ON "public"."document_folders" FOR EACH ROW
EXECUTE FUNCTION "public"."maintain_chat_messages_folder_references" ();

GRANT ALL ON TABLE "public"."document_folders" TO "anon";

GRANT ALL ON TABLE "public"."document_folders" TO "authenticated";

GRANT ALL ON TABLE "public"."document_folders" TO "service_role";

GRANT ALL ON SEQUENCE "public"."document_folders_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."document_folders_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."document_folders_id_seq" TO "service_role";
