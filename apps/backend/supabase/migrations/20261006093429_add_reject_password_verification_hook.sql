SET
    check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.reject_password_verification (event JSONB) RETURNS JSONB LANGUAGE plpgsql
SET
    search_path TO '' AS $function$
BEGIN
RETURN pg_catalog.jsonb_build_object(
    'decision', 'reject',
    'message', 'Die Anmeldung mit Passwort ist deaktiviert. Bitte melden Sie sich mit dem per E-Mail gesendeten Code an.'
);
END;
$function$;

GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";

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
