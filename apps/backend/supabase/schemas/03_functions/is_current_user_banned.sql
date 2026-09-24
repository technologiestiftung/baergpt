CREATE OR REPLACE FUNCTION "public"."is_current_user_banned_or_deleted" () RETURNS BOOLEAN LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
SELECT
    -- Treat a deleted user (valid pre-deletion session, but no row) as banned
    NOT EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM auth.users u
        WHERE u.id = auth.uid()
          AND u.banned_until IS NOT NULL
          AND u.banned_until > now()
    );
$$;

ALTER FUNCTION "public"."is_current_user_banned_or_deleted" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."is_current_user_banned_or_deleted" () IS 'Returns TRUE if the current user is banned (auth.users.banned_until in the future).';

REVOKE ALL ON FUNCTION "public"."is_current_user_banned_or_deleted" ()
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."is_current_user_banned_or_deleted" () TO "anon";

GRANT ALL ON FUNCTION "public"."is_current_user_banned_or_deleted" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_current_user_banned_or_deleted" () TO "service_role";
