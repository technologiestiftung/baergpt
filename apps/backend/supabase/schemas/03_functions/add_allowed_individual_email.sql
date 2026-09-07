CREATE OR REPLACE FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

INSERT INTO public.allowed_individual_emails (email, created_by)
VALUES (lower(trim(p_email)), auth.uid());
END;
$$;

ALTER FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") IS 'Adds an individual email to the allowlist (active by default). Format enforced by CHECK constraint.';

GRANT ALL ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") TO "service_role";
