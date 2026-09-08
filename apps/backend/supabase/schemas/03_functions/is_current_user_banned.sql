CREATE OR REPLACE FUNCTION "public"."is_current_user_banned" () RETURNS BOOLEAN LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.banned_until IS NOT NULL
      AND u.banned_until > now()
);
$$;

ALTER FUNCTION "public"."is_current_user_banned" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."is_current_user_banned" () IS 'Returns TRUE if the current user is banned (auth.users.banned_until in the future).';

REVOKE ALL ON FUNCTION "public"."is_current_user_banned" ()
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."is_current_user_banned" () TO "anon";

GRANT ALL ON FUNCTION "public"."is_current_user_banned" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_current_user_banned" () TO "service_role";
