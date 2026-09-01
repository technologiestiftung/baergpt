CREATE TABLE IF NOT EXISTS "public"."allowed_individual_emails" (
    "id" INTEGER NOT NULL,
    "email" "text" NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "allowed_individual_emails_format" CHECK (
        (
            "email" ~ '^[a-zA-Z0-9._%+\-]+@[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?)+$'::"text"
        )
    )
);

ALTER TABLE "public"."allowed_individual_emails" OWNER TO "postgres";

COMMENT ON TABLE "public"."allowed_individual_emails" IS 'Individual email addresses explicitly permitted to sign up, independently of allowed_email_domains.';

CREATE SEQUENCE IF NOT EXISTS "public"."allowed_individual_emails_id_seq" AS INTEGER START
WITH
    1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "public"."allowed_individual_emails_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."allowed_individual_emails_id_seq" OWNED BY "public"."allowed_individual_emails"."id";

ALTER TABLE ONLY "public"."allowed_individual_emails"
ALTER COLUMN "id"
SET DEFAULT "nextval" ('"public"."allowed_individual_emails_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."allowed_individual_emails"
ADD CONSTRAINT "allowed_individual_emails_email_key" UNIQUE ("email");

ALTER TABLE ONLY "public"."allowed_individual_emails"
ADD CONSTRAINT "allowed_individual_emails_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_allowed_individual_emails_email" ON "public"."allowed_individual_emails" USING "btree" ("lower" ("email"));

GRANT ALL ON TABLE "public"."allowed_individual_emails" TO "anon";

GRANT ALL ON TABLE "public"."allowed_individual_emails" TO "authenticated";

GRANT ALL ON TABLE "public"."allowed_individual_emails" TO "service_role";

GRANT ALL ON SEQUENCE "public"."allowed_individual_emails_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."allowed_individual_emails_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."allowed_individual_emails_id_seq" TO "service_role";
