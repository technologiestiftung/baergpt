-- Fired by the trigger record_session_activity_before_delete on auth.sessions,
-- which lives in the migration because the auth schema isn't diffable.
CREATE OR REPLACE FUNCTION "public"."record_session_activity" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
-- Deleting a user cascades to its sessions after the user row is gone, which must not insert a row for it
INSERT INTO public.user_session_activity (user_id, last_active_at)
SELECT old.user_id, old.updated_at
WHERE old.updated_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = old.user_id)
ON CONFLICT (user_id) DO UPDATE
    SET last_active_at = GREATEST(public.user_session_activity.last_active_at, excluded.last_active_at);
RETURN old;
END;
$$;

ALTER FUNCTION "public"."record_session_activity" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."record_session_activity" () IS 'Keeps the last refresh of a removed session (e.g. after sign-out) in user_session_activity, so get_inactive_users still counts it as activity.';

REVOKE ALL ON FUNCTION "public"."record_session_activity" ()
FROM
    PUBLIC;

REVOKE ALL ON FUNCTION "public"."record_session_activity" ()
FROM
    "anon";

REVOKE ALL ON FUNCTION "public"."record_session_activity" ()
FROM
    "authenticated";

GRANT ALL ON FUNCTION "public"."record_session_activity" () TO "service_role";
