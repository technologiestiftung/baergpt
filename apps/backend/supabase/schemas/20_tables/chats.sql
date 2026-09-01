CREATE TABLE IF NOT EXISTS "public"."chats" (
    "id" INTEGER NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    "name" "text" NOT NULL
);

ALTER TABLE "public"."chats" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."chats_id_seq" AS INTEGER START
WITH
    1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "public"."chats_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."chats_id_seq" OWNED BY "public"."chats"."id";

ALTER TABLE ONLY "public"."chats"
ALTER COLUMN "id"
SET DEFAULT "nextval" ('"public"."chats_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."chats"
ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_chats_user_id" ON "public"."chats" USING "btree" ("user_id");

GRANT ALL ON TABLE "public"."chats" TO "anon";

GRANT ALL ON TABLE "public"."chats" TO "authenticated";

GRANT ALL ON TABLE "public"."chats" TO "service_role";

GRANT ALL ON SEQUENCE "public"."chats_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."chats_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."chats_id_seq" TO "service_role";
