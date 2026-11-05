-- TABLE
CREATE TABLE IF NOT EXISTS "public"."inactivity_notifications" (
    "user_id" "uuid" NOT NULL,
    "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "deletion_date" DATE NOT NULL,
    "warning_sent_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "reminder_sent_at" TIMESTAMP WITH TIME ZONE
);

ALTER TABLE "public"."inactivity_notifications" OWNER TO "postgres";

COMMENT ON TABLE "public"."inactivity_notifications" IS 'Pending deletions of inactive accounts, written by the process-inactive-users job when the warning email goes out. Only the service role may access this table.';

COMMENT ON COLUMN "public"."inactivity_notifications"."last_active_at" IS 'The last activity (login or session refresh) the deletion was scheduled from. Newer activity makes the row stale, which cancels the deletion.';

ALTER TABLE ONLY "public"."inactivity_notifications"
ADD CONSTRAINT "inactivity_notifications_pkey" PRIMARY KEY ("user_id");

-- FOREIGN KEYS
ALTER TABLE ONLY "public"."inactivity_notifications"
ADD CONSTRAINT "inactivity_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

-- RLS POLICIES
-- RLS is enabled without any policies on purpose: anon and authenticated
-- can never read or write rows, only the service role (backend) can.
ALTER TABLE "public"."inactivity_notifications" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."inactivity_notifications"
FROM
    "anon";

REVOKE ALL ON TABLE "public"."inactivity_notifications"
FROM
    "authenticated";

GRANT ALL ON TABLE "public"."inactivity_notifications" TO "service_role";
