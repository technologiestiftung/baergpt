CREATE OR REPLACE FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

UPDATE public.allowed_email_domains
SET is_active = true,
    last_status_change_at = now(),
    last_status_change_by = auth.uid()
WHERE lower(domain) = lower(p_domain);

IF NOT FOUND THEN
		RAISE EXCEPTION 'Allowed domain % not found', p_domain;
END IF;
END;
$$;

ALTER FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") IS 'Reactivates a domain (re-enables new signups only; does not reactivate users).';

GRANT ALL ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") TO "service_role";
