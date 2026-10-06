CREATE OR REPLACE FUNCTION "public"."check_email_registration_status" ("p_email" "text") RETURNS TABLE ("user_exists" BOOLEAN, "is_confirmed" BOOLEAN) LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
DECLARE
v_confirmed_at timestamptz;
  v_found boolean;
BEGIN
SELECT u.email_confirmed_at INTO v_confirmed_at
FROM auth.users u
WHERE lower(u.email) = lower(p_email)
    LIMIT 1;

v_found := FOUND;

RETURN QUERY SELECT v_found, (v_found AND v_confirmed_at IS NOT NULL);
END;
$$;

ALTER FUNCTION "public"."check_email_registration_status" ("p_email" "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."check_email_registration_status" ("p_email" "text")
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."check_email_registration_status" ("p_email" "text") TO "service_role";
