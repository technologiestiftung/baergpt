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

CREATE TABLE "public"."user_session_activity" ("user_id" UUID NOT NULL, "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL);

ALTER TABLE "public"."user_session_activity" enable ROW level security;

CREATE UNIQUE INDEX user_session_activity_pkey ON public.user_session_activity USING btree (user_id);

ALTER TABLE "public"."user_session_activity"
ADD CONSTRAINT "user_session_activity_pkey" PRIMARY KEY USING index "user_session_activity_pkey";

ALTER TABLE "public"."user_session_activity"
ADD CONSTRAINT "user_session_activity_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE NOT valid;

ALTER TABLE "public"."user_session_activity" validate CONSTRAINT "user_session_activity_user_id_fkey";

SET
    check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.record_session_activity () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path TO '' AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_inactive_user (target_user_id UUID, expected_last_active_at TIMESTAMP WITH TIME ZONE, expected_deletion_date date) RETURNS TABLE (deleted BOOLEAN, documents JSONB) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path TO '' AS $function$
DECLARE
    current_state record;
    owned_documents jsonb;
BEGIN
    -- Locked until commit, so a login or session refresh can't slip in between the check and the delete
    PERFORM 1 FROM auth.users WHERE id = target_user_id FOR UPDATE;
    PERFORM 1 FROM auth.sessions WHERE user_id = target_user_id FOR UPDATE;

    SELECT * INTO current_state FROM public.get_inactive_users(now(), target_user_id);

    IF NOT FOUND
        OR current_state.is_banned
        OR current_state.deletion_date IS NULL
        OR current_state.deletion_date IS DISTINCT FROM expected_deletion_date
        OR current_state.last_active_at IS DISTINCT FROM expected_last_active_at THEN
        RETURN QUERY SELECT FALSE, '[]'::jsonb;
        RETURN;
    END IF;

    -- Read under the lock, so the storage cleanup covers every document the cascade removes
    SELECT COALESCE(jsonb_agg(jsonb_build_object('source_url', d.source_url, 'source_type', d.source_type)), '[]'::jsonb)
    INTO owned_documents
    FROM public.documents d
    WHERE d.owned_by_user_id = target_user_id;

    DELETE FROM auth.users WHERE id = target_user_id;
    RETURN QUERY SELECT TRUE, owned_documents;
END;
$function$;

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
         -- last_sign_in_at only changes on an explicit login, a session refresh only updates auth.sessions,
         -- and a removed session's last refresh is kept in user_session_activity
         CROSS JOIN LATERAL (
             SELECT GREATEST(
                 COALESCE(u.last_sign_in_at, u.created_at),
                 (SELECT max(s.updated_at) FROM auth.sessions s WHERE s.user_id = u.id),
                 (SELECT sa.last_active_at FROM public.user_session_activity sa WHERE sa.user_id = u.id)
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

GRANT delete ON TABLE "public"."user_session_activity" TO "service_role";

GRANT insert ON TABLE "public"."user_session_activity" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_session_activity" TO "service_role";

GRANT
SELECT
    ON TABLE "public"."user_session_activity" TO "service_role";

GRANT trigger ON TABLE "public"."user_session_activity" TO "service_role";

GRANT
TRUNCATE ON TABLE "public"."user_session_activity" TO "service_role";

GRANT
UPDATE ON TABLE "public"."user_session_activity" TO "service_role";

-- Not emitted by `supabase db diff`: the auth schema isn't diffable.
-- GoTrue deletes a session on sign-out, which would lose its last refresh.
CREATE OR REPLACE TRIGGER record_session_activity_before_delete
BEFORE DELETE ON auth.sessions FOR EACH ROW
EXECUTE FUNCTION public.record_session_activity ();

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

REVOKE ALL ON TABLE "public"."user_session_activity"
FROM
    "anon";

REVOKE ALL ON TABLE "public"."user_session_activity"
FROM
    "authenticated";

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

REVOKE ALL ON FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
)
FROM
    PUBLIC;

REVOKE ALL ON FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
)
FROM
    "anon";

REVOKE ALL ON FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
)
FROM
    "authenticated";

GRANT ALL ON FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
) TO "service_role";

COMMENT ON TABLE "public"."inactivity_notifications" IS 'Pending deletions of inactive accounts, written by the process-inactive-users job when the warning email goes out. Only the service role may access this table.';

COMMENT ON COLUMN "public"."inactivity_notifications"."last_active_at" IS 'The last activity (login or session refresh) the deletion was scheduled from. Newer activity makes the row stale, which cancels the deletion.';

COMMENT ON FUNCTION "public"."get_inactive_users" ("inactive_since" TIMESTAMP WITH TIME ZONE, "for_user_id" "uuid") IS 'Confirmed users without a login or session refresh since inactive_since (or since registration), plus users with a pending inactivity deletion. Only the service role may call this function.';

COMMENT ON TABLE "public"."user_session_activity" IS 'Last refresh of removed sessions, written by record_session_activity because GoTrue deletes a session on sign-out. Only the service role may access this table.';

COMMENT ON FUNCTION "public"."record_session_activity" () IS 'Keeps the last refresh of a removed session (e.g. after sign-out) in user_session_activity, so get_inactive_users still counts it as activity.';

COMMENT ON FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
) IS 'Deletes an account with a pending inactivity deletion, but only if it is unchanged since the job planned it (same deletion date and last activity, not banned). Returns whether it was deleted and the storage files of its documents. Only the service role may call this function.';
