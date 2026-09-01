CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" INTEGER NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    "role" "text" NOT NULL,
    "type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[],
    "citations" "jsonb",
    "web_citations" "jsonb",
    "parla_citations" "jsonb",
    "open_data_citations" "jsonb",
    "external_tool_context" BOOLEAN DEFAULT FALSE NOT NULL
);

ALTER TABLE "public"."chat_messages" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."chat_messages_id_seq" AS INTEGER START
WITH
    1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "public"."chat_messages_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."chat_messages_id_seq" OWNED BY "public"."chat_messages"."id";

ALTER TABLE ONLY "public"."chat_messages"
ALTER COLUMN "id"
SET DEFAULT "nextval" ('"public"."chat_messages_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."chat_messages"
ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_chat_messages_allowed_document_ids_gin" ON "public"."chat_messages" USING "gin" ("allowed_document_ids");

CREATE INDEX "idx_chat_messages_chat_id" ON "public"."chat_messages" USING "btree" ("chat_id");

CREATE INDEX "idx_chat_messages_content_trgm" ON "public"."chat_messages" USING "gin" ("content" "extensions"."gin_trgm_ops");

CREATE INDEX "idx_chat_messages_role" ON "public"."chat_messages" USING "btree" ("role");

GRANT ALL ON TABLE "public"."chat_messages" TO "anon";

GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";

GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";

GRANT ALL ON SEQUENCE "public"."chat_messages_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."chat_messages_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."chat_messages_id_seq" TO "service_role";
