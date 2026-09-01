CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "academic_title" "text",
    "personal_title" "text",
    "num_inferences" INTEGER DEFAULT 0,
    "num_inference_tokens" BIGINT DEFAULT 0,
    "num_documents" INTEGER DEFAULT 0,
    "num_embedding_tokens" BIGINT DEFAULT 0,
    "is_addressed_formal" BOOLEAN DEFAULT TRUE,
    "personal_system_prompt" "text",
    CONSTRAINT "personal_system_prompt_length" CHECK (("char_length" ("personal_system_prompt") <= 500))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

COMMENT ON COLUMN "public"."profiles"."personal_system_prompt" IS 'User-defined personal system prompt, merged into the global system prompt on every chat request. NULL means none set.';

ALTER TABLE ONLY "public"."profiles"
ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

CREATE OR REPLACE TRIGGER "add_new_user_to_access_group_trigger"
AFTER INSERT ON "public"."profiles" FOR EACH ROW
EXECUTE FUNCTION "public"."add_user_to_access_group" ();

CREATE OR REPLACE TRIGGER "normalize_personal_system_prompt_trigger"
BEFORE INSERT OR UPDATE OF "personal_system_prompt" ON "public"."profiles" FOR EACH ROW
EXECUTE FUNCTION "public"."normalize_personal_system_prompt" ();

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";
