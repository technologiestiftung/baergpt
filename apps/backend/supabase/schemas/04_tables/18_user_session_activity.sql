-- TABLE
CREATE TABLE IF NOT EXISTS "public"."user_session_activity" ("user_id" "uuid" NOT NULL, "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL);

ALTER TABLE "public"."user_session_activity" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_session_activity" IS 'Last refresh of removed sessions, written by record_session_activity because GoTrue deletes a session on sign-out. Only the service role may access this table.';

ALTER TABLE ONLY "public"."user_session_activity"
ADD CONSTRAINT "user_session_activity_pkey" PRIMARY KEY ("user_id");

-- FOREIGN KEYS
ALTER TABLE ONLY "public"."user_session_activity"
ADD CONSTRAINT "user_session_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

-- RLS POLICIES
-- RLS is enabled without any policies on purpose: anon and authenticated
-- can never read or write rows, only the service role (backend) can.
ALTER TABLE "public"."user_session_activity" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."user_session_activity"
FROM
    "anon";

REVOKE ALL ON TABLE "public"."user_session_activity"
FROM
    "authenticated";

GRANT ALL ON TABLE "public"."user_session_activity" TO "service_role";
