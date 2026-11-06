CREATE OR REPLACE FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
) RETURNS TABLE ("deleted" BOOLEAN, "documents" "jsonb") LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
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
$$;

ALTER FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."delete_inactive_user" (
    "target_user_id" "uuid",
    "expected_last_active_at" TIMESTAMP WITH TIME ZONE,
    "expected_deletion_date" DATE
) IS 'Deletes an account with a pending inactivity deletion, but only if it is unchanged since the job planned it (same deletion date and last activity, not banned). Returns whether it was deleted and the storage files of its documents. Only the service role may call this function.';

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
