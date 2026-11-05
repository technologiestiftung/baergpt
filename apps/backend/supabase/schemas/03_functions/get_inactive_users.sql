CREATE OR REPLACE FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE (
    "user_id" "uuid",
    "email" "text",
    "first_name" "text",
    "last_name" "text",
    "last_active_at" TIMESTAMP WITH TIME ZONE,
    "is_banned" BOOLEAN,
    "notified_last_active_at" TIMESTAMP WITH TIME ZONE,
    "deletion_date" DATE,
    "warning_sent_at" TIMESTAMP WITH TIME ZONE,
    "reminder_sent_at" TIMESTAMP WITH TIME ZONE
) LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
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
$$;

ALTER FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid") IS 'Confirmed users without a login or session refresh since inactive_since (or since registration), plus users with a pending inactivity deletion. Only the service role may call this function.';

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
