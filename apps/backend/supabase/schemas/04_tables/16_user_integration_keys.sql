-- TABLE
CREATE TABLE IF NOT EXISTS "public"."user_integration_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid" () NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "ciphertext" "bytea" NOT NULL,
    "iv" "bytea" NOT NULL,
    "auth_tag" "bytea" NOT NULL,
    "last4" "text" NOT NULL,
    "scopes" "text" [] NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    CONSTRAINT "user_integration_keys_provider_check" CHECK (("provider" = 'datawrapper'::"text"))
);

ALTER TABLE "public"."user_integration_keys" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_integration_keys" IS 'Per-user API keys for third-party integrations, AES-256-GCM encrypted by the backend. Only the service role may access this table.';

COMMENT ON COLUMN "public"."user_integration_keys"."scopes" IS 'Provider-specific scopes (permissions) for this key verified when it was saved.';

ALTER TABLE ONLY "public"."user_integration_keys"
ADD CONSTRAINT "user_integration_keys_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_integration_keys"
ADD CONSTRAINT "user_integration_keys_user_id_provider_key" UNIQUE ("user_id", "provider");

-- FOREIGN KEYS
ALTER TABLE ONLY "public"."user_integration_keys"
ADD CONSTRAINT "user_integration_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

-- RLS POLICIES
-- RLS is enabled without any policies on purpose: anon and authenticated
-- can never read or write rows, only the service role (backend) can.
ALTER TABLE "public"."user_integration_keys" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."user_integration_keys"
FROM
    "anon";

REVOKE ALL ON TABLE "public"."user_integration_keys"
FROM
    "authenticated";

GRANT ALL ON TABLE "public"."user_integration_keys" TO "service_role";
