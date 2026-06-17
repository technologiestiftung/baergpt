-- Domain allowlist runtime RPCs. Self-authorizing, called directly from the admin
-- panel via supabase.rpc. Each checks the caller is an admin
-- (auth.uid() in application_admins) and is granted to authenticated. 
-- List: derives created_by / last_status_change_by emails and a per-domain user_count
-- (single aggregation over auth.users).
CREATE OR REPLACE FUNCTION public.get_allowed_email_domains_admin () RETURNS TABLE (
    id INTEGER,
    domain TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    created_by TEXT,
    last_status_change_at TIMESTAMPTZ,
    last_status_change_by TEXT,
    user_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
	END IF;

	RETURN QUERY
	SELECT
		aed.id,
		aed.domain,
		aed.is_active,
		aed.created_at,
		creator.email::text,
		aed.last_status_change_at,
		changer.email::text,
		COALESCE(uc.user_count, 0)::bigint
	FROM public.allowed_email_domains aed
	LEFT JOIN auth.users creator ON creator.id = aed.created_by
	LEFT JOIN auth.users changer ON changer.id = aed.last_status_change_by
	LEFT JOIN (
		SELECT lower(split_part(u.email, '@', 2)) AS domain, count(*) AS user_count
		FROM auth.users u
		GROUP BY 1
	) uc ON uc.domain = lower(aed.domain)
	ORDER BY aed.domain;
END;
$$;

COMMENT ON FUNCTION public.get_allowed_email_domains_admin () IS 'Admin listing of allowed domains with creator/last-changer emails and matching-user counts.';

GRANT
EXECUTE ON FUNCTION public.get_allowed_email_domains_admin () TO authenticated;

-- Add a domain. New domains start active (is_active DEFAULT true) and have no 
-- status change yet (last_status_change stays null). created_by = the acting admin.
-- Format is enforced by the allowed_email_domains_exact_format CHECK constraint.
CREATE OR REPLACE FUNCTION public.add_allowed_domain (p_domain TEXT) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
	END IF;

	INSERT INTO public.allowed_email_domains (domain, created_by)
	VALUES (lower(trim(p_domain)), auth.uid());
END;
$$;

COMMENT ON FUNCTION public.add_allowed_domain (TEXT) IS 'Adds a domain (active by default, no status-change stamp). Format enforced by the CHECK constraint.';

GRANT
EXECUTE ON FUNCTION public.add_allowed_domain (TEXT) TO authenticated;

-- Reactivate a domain (re-enables new signups only; does NOT reactivate users).
-- Stamps last_status_change with the acting admin.
CREATE OR REPLACE FUNCTION public.activate_allowed_domain (p_domain TEXT) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
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

COMMENT ON FUNCTION public.activate_allowed_domain (TEXT) IS 'Reactivates a domain (re-enables new signups only; does not reactivate users).';

GRANT
EXECUTE ON FUNCTION public.activate_allowed_domain (TEXT) TO authenticated;

-- Deactivate a domain: flip the row (stamp last_status_change) and pure-deactivate its
-- non-admin users (is_active=false, NO deleted_at, so they are not purge-armed). Admins
-- are exempt. Returns the number of users deactivated.
CREATE OR REPLACE FUNCTION public.deactivate_allowed_domain (p_domain TEXT) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = ''
SET
    statement_timeout TO '60000' AS $$
DECLARE
	v_domain TEXT;
	v_count INTEGER;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
	END IF;

	UPDATE public.allowed_email_domains
	SET is_active = false,
		last_status_change_at = now(),
		last_status_change_by = auth.uid()
	WHERE lower(domain) = lower(p_domain)
	RETURNING lower(domain) INTO v_domain;

	IF v_domain IS NULL THEN
		RAISE EXCEPTION 'Allowed domain % not found', p_domain;
	END IF;

	WITH affected AS (
		UPDATE public.user_active_status uas
		SET is_active = false
		WHERE uas.is_active = true
			AND uas.id IN (
				SELECT u.id
				FROM auth.users u
				WHERE lower(split_part(u.email, '@', 2)) = v_domain
					AND u.id NOT IN (SELECT user_id FROM public.application_admins)
			)
		RETURNING uas.id
	)
	SELECT count(*) INTO v_count FROM affected;

	RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.deactivate_allowed_domain (TEXT) IS 'Deactivates a domain and deactivates affected users (no deleted_at). Admins are exempt.';

GRANT
EXECUTE ON FUNCTION public.deactivate_allowed_domain (TEXT) TO authenticated;
