CREATE OR REPLACE FUNCTION "public"."reject_password_verification" ("event" "jsonb") RETURNS "jsonb" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
RETURN pg_catalog.jsonb_build_object(
    'decision', 'reject',
    'message', 'Die Anmeldung mit Passwort ist deaktiviert. Bitte melden Sie sich mit dem per E-Mail gesendeten Code an.'
);
END;
$$;

ALTER FUNCTION "public"."reject_password_verification" ("event" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."reject_password_verification" ("event" "jsonb") IS 'GoTrue password verification hook: rejects every password login, including correct passwords. Login and registration use email OTP only.';

REVOKE ALL ON FUNCTION "public"."reject_password_verification" ("event" "jsonb")
FROM
    PUBLIC;

REVOKE ALL ON FUNCTION "public"."reject_password_verification" ("event" "jsonb")
FROM
    "anon";

REVOKE ALL ON FUNCTION "public"."reject_password_verification" ("event" "jsonb")
FROM
    "authenticated";

REVOKE ALL ON FUNCTION "public"."reject_password_verification" ("event" "jsonb")
FROM
    "service_role";

GRANT
EXECUTE ON FUNCTION "public"."reject_password_verification" ("event" "jsonb") TO "supabase_auth_admin";
