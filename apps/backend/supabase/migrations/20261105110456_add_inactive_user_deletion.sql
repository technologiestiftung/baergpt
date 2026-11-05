CREATE TABLE "public"."inactivity_notifications" (
    "user_id" UUID NOT NULL,
    "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "deletion_date" date NOT NULL,
    "warning_sent_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "reminder_sent_at" TIMESTAMP WITH TIME ZONE
);

ALTER TABLE "public"."inactivity_notifications" enable ROW level security;

CREATE UNIQUE INDEX inactivity_notifications_pkey ON public.inactivity_notifications USING btree (user_id);

ALTER TABLE "public"."inactivity_notifications"
ADD CONSTRAINT "inactivity_notifications_pkey" PRIMARY KEY USING index "inactivity_notifications_pkey";

ALTER TABLE "public"."inactivity_notifications"
ADD CONSTRAINT "inactivity_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT valid;

ALTER TABLE "public"."inactivity_notifications" validate CONSTRAINT "inactivity_notifications_user_id_fkey";

SET
    check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_inactive_users (inactive_since TIMESTAMP WITH TIME ZONE, for_user_id UUID DEFAULT NULL::UUID) RETURNS TABLE (
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    last_active_at TIMESTAMP WITH TIME ZONE,
    is_banned BOOLEAN,
    notified_last_active_at TIMESTAMP WITH TIME ZONE,
    deletion_date date,
    warning_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE
) LANGUAGE sql SECURITY DEFINER
SET
    search_path TO '' AS $function$
SELECT
    u.id::uuid,
    u.email::text,
    p.first_name::text,
    p.last_name::text,
    a.last_active_at,
    COALESCE(u.banned_until > now(), FALSE),
    n.last_active_at,
    n.deletion_date,
    n.warning_sent_at,
    n.reminder_sent_at
FROM auth.users u
         -- last_sign_in_at only changes on an explicit login, a session refresh only updates auth.sessions
         CROSS JOIN LATERAL (
             SELECT GREATEST(
                 COALESCE(u.last_sign_in_at, u.created_at),
                 (SELECT max(s.updated_at) FROM auth.sessions s WHERE s.user_id = u.id)
             )::timestamptz AS last_active_at
         ) a
         LEFT JOIN public.profiles p ON p.id = u.id
         LEFT JOIN public.inactivity_notifications n ON n.user_id = u.id
WHERE (for_user_id IS NULL OR u.id = for_user_id)
  -- Users with a pending deletion are returned even after a login or ban, so the job can cancel it.
  -- Banned accounts can't log in to keep their account, so admins decide about them.
  -- Unconfirmed addresses may belong to someone else, so they get no emails.
  AND (n.user_id IS NOT NULL
    OR (a.last_active_at < inactive_since
      AND u.email_confirmed_at IS NOT NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())))
ORDER BY u.id;
$function$;

GRANT delete ON TABLE "public"."inactivity_notifications" TO "service_role";

GRANT insert ON TABLE "public"."inactivity_notifications" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inactivity_notifications" TO "service_role";

GRANT
SELECT
    ON TABLE "public"."inactivity_notifications" TO "service_role";

GRANT trigger ON TABLE "public"."inactivity_notifications" TO "service_role";

GRANT
TRUNCATE ON TABLE "public"."inactivity_notifications" TO "service_role";

GRANT
UPDATE ON TABLE "public"."inactivity_notifications" TO "service_role";

-- Not emitted by `supabase db diff`: default privileges grant everything to
-- anon/authenticated on CREATE TABLE and CREATE FUNCTION, so revoke explicitly.
-- Only the service role (process-inactive-users job) may see inactive users.
REVOKE ALL ON TABLE "public"."inactivity_notifications"
FROM
    "anon";

REVOKE ALL ON TABLE "public"."inactivity_notifications"
FROM
    "authenticated";

REVOKE ALL ON FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid")
FROM
    PUBLIC;

REVOKE ALL ON FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid")
FROM
    "anon";

REVOKE ALL ON FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid")
FROM
    "authenticated";

GRANT ALL ON FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid") TO "service_role";

COMMENT ON TABLE "public"."inactivity_notifications" IS 'Pending deletions of inactive accounts, written by the process-inactive-users job when the warning email goes out. Only the service role may access this table.';

COMMENT ON COLUMN "public"."inactivity_notifications"."last_active_at" IS 'The last activity (login or session refresh) the deletion was scheduled from. Newer activity makes the row stale, which cancels the deletion.';

COMMENT ON FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid") IS 'Confirmed users without a login or session refresh since inactive_since (or since registration), plus users with a pending inactivity deletion. Only the service role may call this function.';
