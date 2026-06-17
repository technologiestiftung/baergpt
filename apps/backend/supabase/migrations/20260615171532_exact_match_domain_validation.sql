-- Switch domain validation to exact-match-only and is_active-aware.
-- Existing users are unaffected; the trigger only gates inserts and email updates.
CREATE OR REPLACE FUNCTION public.validate_email_domain () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
DECLARE
	email_domain TEXT;
	is_valid BOOLEAN := FALSE;
BEGIN
	IF NEW.email NOT LIKE '%@%' THEN
		RAISE EXCEPTION 'Invalid email format: missing @ symbol';
	END IF;

	email_domain := lower(split_part(NEW.email, '@', 2));

	IF email_domain IS NULL OR email_domain = '' THEN
		RAISE EXCEPTION 'Invalid email format: missing domain';
	END IF;

	SELECT EXISTS (
		SELECT 1
		FROM public.allowed_email_domains
		WHERE lower(domain) = email_domain
			AND is_active = TRUE
	) INTO is_valid;

	IF NOT is_valid THEN
		RAISE EXCEPTION 'Email domain "%" is not in the list of allowed domains', email_domain
			USING HINT = 'Contact your administrator if you believe this domain should be allowed.';
	END IF;

	RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_email_domain () IS 'Validates new user emails against active (is_active=true) exact-match domains in allowed_email_domains.';

-- Update the read RPC used by the registration page to expose only active domains
CREATE OR REPLACE FUNCTION public.get_allowed_email_domains () RETURNS TABLE (id INTEGER, domain TEXT) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
	RETURN QUERY
	SELECT aed.id, aed.domain
	FROM public.allowed_email_domains aed
	WHERE aed.is_active = TRUE
	ORDER BY aed.domain;
END;
$$;

COMMENT ON FUNCTION public.get_allowed_email_domains () IS 'Returns active allowed email domains for user registration.';
