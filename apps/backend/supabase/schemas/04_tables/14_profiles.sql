-- TABLE

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

-- FOREIGN KEYS

ALTER TABLE ONLY "public"."profiles"
ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

-- RLS POLICIES

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to access own profile" ON "public"."profiles" FOR
SELECT
    TO "authenticated" USING (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT
WITH
    CHECK (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

CREATE POLICY "Users can update own profile." ON "public"."profiles"
FOR UPDATE
    USING (
        (
            (
                (
                    SELECT
                        "auth"."uid" () AS "uid"
                ) = "id"
            )
            AND (NOT "public"."is_current_user_banned" ())
        )
    );

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";
