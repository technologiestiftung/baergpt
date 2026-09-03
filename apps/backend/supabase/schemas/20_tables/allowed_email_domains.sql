CREATE TABLE IF NOT EXISTS "public"."allowed_email_domains" (
    "id" INTEGER NOT NULL,
    "domain" "text" NOT NULL,
    "is_active" BOOLEAN DEFAULT TRUE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    "created_by" "uuid",
    "last_status_change_at" TIMESTAMP WITH TIME ZONE,
    "last_status_change_by" "uuid",
    CONSTRAINT "allowed_email_domains_exact_format" CHECK (
        (
            "domain" ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'::"text"
        )
    )
);

ALTER TABLE "public"."allowed_email_domains" OWNER TO "postgres";

COMMENT ON TABLE "public"."allowed_email_domains" IS 'Table containing allowed email domains for user registration';

CREATE SEQUENCE IF NOT EXISTS "public"."allowed_email_domains_id_seq" AS INTEGER START
WITH
    1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "public"."allowed_email_domains_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."allowed_email_domains_id_seq" OWNED BY "public"."allowed_email_domains"."id";

ALTER TABLE ONLY "public"."allowed_email_domains"
ALTER COLUMN "id"
SET DEFAULT "nextval" ('"public"."allowed_email_domains_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."allowed_email_domains"
ADD CONSTRAINT "allowed_email_domains_domain_key" UNIQUE ("domain");

ALTER TABLE ONLY "public"."allowed_email_domains"
ADD CONSTRAINT "allowed_email_domains_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_allowed_email_domains_is_active" ON "public"."allowed_email_domains" USING "btree" ("is_active");

GRANT ALL ON TABLE "public"."allowed_email_domains" TO "anon";

GRANT ALL ON TABLE "public"."allowed_email_domains" TO "authenticated";

GRANT ALL ON TABLE "public"."allowed_email_domains" TO "service_role";

GRANT ALL ON SEQUENCE "public"."allowed_email_domains_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."allowed_email_domains_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."allowed_email_domains_id_seq" TO "service_role";
