ALTER TABLE user_active_status
ADD COLUMN IF NOT EXISTS registration_finished_at TIMESTAMP WITH TIME ZONE NULL;

CREATE OR REPLACE FUNCTION public.log_account_activation () returns void language plpgsql
SET
	search_path = '' security definer AS $$
BEGIN
    UPDATE public.user_active_status 
    SET 
        registration_finished_at = NOW()
    WHERE id = auth.uid() AND registration_finished_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_account_activation_timestamp () returns TIMESTAMP WITH TIME ZONE language plpgsql
SET
	search_path = '' security definer AS $$
DECLARE
    activation_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT registration_finished_at
    INTO activation_timestamp
    FROM public.user_active_status
    WHERE id = (SELECT auth.uid());
    
    RETURN activation_timestamp;
END;
$$;

comment ON function get_account_activation_timestamp IS 'Returns the registration_finished_at timestamp for the current user, or NULL if not activated';
