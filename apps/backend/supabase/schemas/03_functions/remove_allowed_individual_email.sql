CREATE OR REPLACE FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

DELETE FROM public.allowed_individual_emails
WHERE lower(email) = lower(p_email);

IF NOT FOUND THEN
        RAISE EXCEPTION 'Individual email % not found', p_email;
END IF;
END;
$$;

ALTER FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") IS 'Removes an individual email from the allowlist.';

GRANT ALL ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") TO "service_role";
