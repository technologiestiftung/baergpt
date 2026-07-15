-- New table for allowing specific individual email addresses to sign up,
-- regardless of whether their domain is in allowed_email_domains.
-- Mirrors the structure and conventions of allowed_email_domains.
CREATE TABLE IF NOT EXISTS public.allowed_individual_emails (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT allowed_individual_emails_format CHECK (
        email ~ '^[a-zA-Z0-9._%+\-]+@[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?)+$'
    )
);

COMMENT ON TABLE public.allowed_individual_emails IS 'Individual email addresses explicitly permitted to sign up, independently of allowed_email_domains.';

CREATE INDEX IF NOT EXISTS idx_allowed_individual_emails_email ON public.allowed_individual_emails (LOWER(email));

-- Enable RLS (access only via SECURITY DEFINER RPCs, same pattern as allowed_email_domains)
ALTER TABLE public.allowed_individual_emails ENABLE ROW LEVEL SECURITY;

-- Shared logic: callable directly (for client-side validation) and by the trigger.
CREATE OR REPLACE FUNCTION public.check_email_allowed (p_email TEXT) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
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

COMMENT ON FUNCTION public.check_email_allowed (TEXT) IS 'Returns TRUE if the email passes the domain or individual-email allowlist check. Used by validate_email_domain trigger and callable directly for client-side validation.';

GRANT
EXECUTE ON FUNCTION public.check_email_allowed (TEXT) TO anon,
authenticated;

-- Trigger function now delegates to check_email_allowed — no duplicated logic.
CREATE OR REPLACE FUNCTION public.validate_email_domain () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
    IF NOT public.check_email_allowed(NEW.email) THEN
        RAISE EXCEPTION 'Email "%" is not in the list of allowed domains or individual emails', NEW.email
            USING HINT = 'Contact your administrator if you believe this email should be allowed.';
END IF;

RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_email_domain () IS 'Trigger: validates new/updated user emails via check_email_allowed().';

-- ─── Admin RPCs (same self-authorizing pattern as domain_allowlist_runtime_functions) ───
-- List all individual emails with audit info and whether the user has already signed up
CREATE OR REPLACE FUNCTION public.get_allowed_individual_emails () RETURNS TABLE (id INTEGER, email TEXT, created_at TIMESTAMPTZ, created_by TEXT, has_account BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

RETURN QUERY
SELECT
    aie.id,
    aie.email,
    aie.created_at,
    creator.email::text,
    EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(aie.email))
FROM public.allowed_individual_emails aie
         LEFT JOIN auth.users creator ON creator.id = aie.created_by
ORDER BY aie.email;
END;
$$;

COMMENT ON FUNCTION public.get_allowed_individual_emails () IS 'Admin listing of allowed individual emails with audit info and account-existence flag.';

GRANT
EXECUTE ON FUNCTION public.get_allowed_individual_emails () TO authenticated;

-- Add an individual email
CREATE OR REPLACE FUNCTION public.add_allowed_individual_email (p_email TEXT) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

INSERT INTO public.allowed_individual_emails (email, created_by)
VALUES (lower(trim(p_email)), auth.uid());
END;
$$;

COMMENT ON FUNCTION public.add_allowed_individual_email (TEXT) IS 'Adds an individual email to the allowlist (active by default). Format enforced by CHECK constraint.';

GRANT
EXECUTE ON FUNCTION public.add_allowed_individual_email (TEXT) TO authenticated;

-- Remove an allowed individual email
CREATE OR REPLACE FUNCTION public.remove_allowed_individual_email (p_email TEXT) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
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

COMMENT ON FUNCTION public.remove_allowed_individual_email (TEXT) IS 'Removes an individual email from the allowlist.';

GRANT
EXECUTE ON FUNCTION public.remove_allowed_individual_email (TEXT) TO authenticated;
