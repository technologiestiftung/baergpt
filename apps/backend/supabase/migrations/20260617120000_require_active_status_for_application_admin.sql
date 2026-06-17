CREATE OR REPLACE FUNCTION public.is_application_admin () returns BOOLEAN language sql security definer
SET
	search_path = '' AS $$
select exists (
    select 1
    from public.application_admins
    where user_id = auth.uid()
) AND public.is_current_user_active();
$$;
