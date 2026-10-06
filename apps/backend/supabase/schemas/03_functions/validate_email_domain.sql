CREATE OR REPLACE FUNCTION "public"."validate_email_domain" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT public.check_email_allowed(NEW.email) THEN
        RAISE EXCEPTION 'Email "%" is not in the list of allowed domains or individual emails', NEW.email
            USING HINT = 'Contact your administrator if you believe this email should be allowed.';
END IF;

RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."validate_email_domain" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."validate_email_domain" () IS 'Trigger: validates new/updated user emails via check_email_allowed().';

GRANT ALL ON FUNCTION "public"."validate_email_domain" () TO "anon";

GRANT ALL ON FUNCTION "public"."validate_email_domain" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_email_domain" () TO "service_role";
