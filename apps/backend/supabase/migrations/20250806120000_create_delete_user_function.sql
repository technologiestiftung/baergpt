CREATE OR REPLACE FUNCTION public.delete_user () returns void language sql security definer
SET
    search_path = '' AS $$
    DELETE FROM auth.users
    WHERE id = auth.uid();
$$;
