-- Ensure security definer function uses an empty search_path
CREATE OR REPLACE FUNCTION public.get_allowed_email_domains () returns TABLE (id INTEGER, domain TEXT) language plpgsql security definer
SET
	search_path = '' AS $$
BEGIN
    RETURN QUERY
    SELECT
        aed.id,
        aed.domain
    FROM public.allowed_email_domains aed
    ORDER BY aed.domain;
END;
$$;

comment ON function public.get_allowed_email_domains () IS 'Returns all allowed email domains for user registration';

-- Add explicit deny-all policies for private tables with RLS enabled
CREATE POLICY application_admins_no_direct_access ON public.application_admins FOR ALL TO public USING (FALSE)
WITH
	CHECK (FALSE);

CREATE POLICY user_active_status_no_direct_access ON public.user_active_status FOR ALL TO public USING (FALSE)
WITH
	CHECK (FALSE);
