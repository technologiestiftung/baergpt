CREATE OR REPLACE FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") RETURNS INTEGER LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO ''
SET
    "statement_timeout" TO '60000' AS $$
DECLARE
v_domain TEXT;
    v_count  INTEGER;
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

UPDATE public.allowed_email_domains
SET is_active            = false,
    last_status_change_at = now(),
    last_status_change_by = auth.uid()
WHERE lower(domain) = lower(p_domain)
    RETURNING lower(domain) INTO v_domain;

IF v_domain IS NULL THEN
        RAISE EXCEPTION 'Allowed domain % not found', p_domain;
END IF;

    -- Ban affected users indefinitely (pure deactivation, no deletion).
WITH affected AS (
UPDATE auth.users
SET banned_until = '2099-01-01 00:00:00+00'
WHERE (banned_until IS NULL OR banned_until < now())
  AND lower(split_part(email, '@', 2)) = v_domain
    RETURNING id
)
SELECT count(*) INTO v_count FROM affected;

RETURN v_count;
END;
$$;

ALTER FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") IS 'Deactivates a domain and bans affected users via auth.users.banned_until.';

GRANT ALL ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") TO "service_role";
