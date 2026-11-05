CREATE TABLE "public"."user_integration_keys" (
    "id" UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "ciphertext" bytea NOT NULL,
    "iv" bytea NOT NULL,
    "auth_tag" bytea NOT NULL,
    "last4" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE "public"."user_integration_keys" enable ROW level security;

CREATE UNIQUE INDEX user_integration_keys_pkey ON public.user_integration_keys USING btree (id);

CREATE UNIQUE INDEX user_integration_keys_user_id_provider_key ON public.user_integration_keys USING btree (user_id, provider);

ALTER TABLE "public"."user_integration_keys"
ADD CONSTRAINT "user_integration_keys_pkey" PRIMARY KEY USING index "user_integration_keys_pkey";

ALTER TABLE "public"."user_integration_keys"
ADD CONSTRAINT "user_integration_keys_provider_check" CHECK ((provider = 'datawrapper'::TEXT)) NOT valid;

ALTER TABLE "public"."user_integration_keys" validate CONSTRAINT "user_integration_keys_provider_check";

ALTER TABLE "public"."user_integration_keys"
ADD CONSTRAINT "user_integration_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT valid;

ALTER TABLE "public"."user_integration_keys" validate CONSTRAINT "user_integration_keys_user_id_fkey";

ALTER TABLE "public"."user_integration_keys"
ADD CONSTRAINT "user_integration_keys_user_id_provider_key" UNIQUE USING index "user_integration_keys_user_id_provider_key";

GRANT delete ON TABLE "public"."user_integration_keys" TO "service_role";

GRANT insert ON TABLE "public"."user_integration_keys" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_integration_keys" TO "service_role";

GRANT
SELECT
    ON TABLE "public"."user_integration_keys" TO "service_role";

GRANT trigger ON TABLE "public"."user_integration_keys" TO "service_role";

GRANT
TRUNCATE ON TABLE "public"."user_integration_keys" TO "service_role";

GRANT
UPDATE ON TABLE "public"."user_integration_keys" TO "service_role";

CREATE TRIGGER auto_set_updated_at_on_user_integration_keys
BEFORE INSERT OR UPDATE ON public.user_integration_keys FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at ();

-- Not emitted by `supabase db diff`: default privileges grant everything to
-- anon/authenticated on CREATE TABLE, so revoke explicitly. Only the service
-- role (backend) may touch encrypted integration keys.
REVOKE ALL ON TABLE "public"."user_integration_keys"
FROM
    "anon";

REVOKE ALL ON TABLE "public"."user_integration_keys"
FROM
    "authenticated";

COMMENT ON TABLE "public"."user_integration_keys" IS 'Per-user API keys for third-party integrations, AES-256-GCM encrypted by the backend. Only the service role may access this table.';

COMMENT ON COLUMN "public"."user_integration_keys"."scopes" IS 'Provider-specific scopes (permissions) for this key verified when it was saved.';
