CREATE OR REPLACE FUNCTION "public"."add_allowed_domain" ("p_domain" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

INSERT INTO public.allowed_email_domains (domain, created_by)
VALUES (lower(trim(p_domain)), auth.uid());
END;
$$;

ALTER FUNCTION "public"."add_allowed_domain" ("p_domain" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") IS 'Adds a domain (active by default, no status-change stamp). Format enforced by the CHECK constraint.';

GRANT ALL ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") TO "service_role";
