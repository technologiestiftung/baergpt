-- Create function to get maintenance mode status
CREATE OR REPLACE FUNCTION public.get_maintenance_mode_status () returns BOOLEAN language sql security definer
SET
	search_path = '' AS $$
    SELECT is_enabled 
    FROM public.maintenance_mode 
    WHERE id = 1;
$$;

-- Grant execute permission to all users (including anon)
GRANT
EXECUTE ON function public.get_maintenance_mode_status () TO anon;

GRANT
EXECUTE ON function public.get_maintenance_mode_status () TO authenticated;

comment ON function public.get_maintenance_mode_status () IS 'Returns the current maintenance mode status. Can be called by anyone including unauthenticated users.';
