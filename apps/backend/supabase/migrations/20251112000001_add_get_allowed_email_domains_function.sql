-- Create function to get allowed email domains
CREATE OR REPLACE FUNCTION public.get_allowed_email_domains () returns TABLE (id INTEGER, domain TEXT) security definer
SET
	search_path = public language plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        aed.id,
        aed.domain
    FROM public.allowed_email_domains aed
    ORDER BY aed.domain;
END;
$$;

-- Add comment to the function
comment ON function public.get_allowed_email_domains () IS 'Returns all allowed email domains for user registration';
