CREATE OR REPLACE FUNCTION "public"."check_email_allowed" ("p_email" "text") RETURNS BOOLEAN LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
DECLARE
email_domain TEXT;
    is_valid     BOOLEAN := FALSE;
BEGIN
    IF p_email NOT LIKE '%@%' THEN
        RETURN FALSE;
END IF;

    email_domain := lower(split_part(p_email, '@', 2));

    IF email_domain IS NULL OR email_domain = '' THEN
        RETURN FALSE;
END IF;

SELECT EXISTS (
    SELECT 1
    FROM public.allowed_email_domains
    WHERE lower(domain) = email_domain
      AND is_active = TRUE
) INTO is_valid;

IF NOT is_valid THEN
SELECT EXISTS (
    SELECT 1
    FROM public.allowed_individual_emails
    WHERE lower(email) = lower(p_email)
) INTO is_valid;
END IF;

RETURN is_valid;
END;
$$;

ALTER FUNCTION "public"."check_email_allowed" ("p_email" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."check_email_allowed" ("p_email" "text") IS 'Returns TRUE if the email passes the domain or individual-email allowlist check. Used by validate_email_domain trigger and callable directly for client-side validation.';

GRANT ALL ON FUNCTION "public"."check_email_allowed" ("p_email" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."check_email_allowed" ("p_email" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."check_email_allowed" ("p_email" "text") TO "service_role";
