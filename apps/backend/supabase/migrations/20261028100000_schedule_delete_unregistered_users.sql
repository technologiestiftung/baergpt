-- Delete sign-ups from the login page that never completed the registration
-- (no code entered or name form left), 24 hours after their last code request or login
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'delete-unregistered-users'
    ) THEN
        PERFORM cron.unschedule('delete-unregistered-users');
END IF;
END;
$$;

SELECT
    cron.schedule (
        'delete-unregistered-users',
        '0 * * * *', -- Every hour
        $$
  DELETE FROM auth.users u
  WHERE u.raw_user_meta_data->>'pending_registration' = 'true'
    AND u.updated_at < NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = u.id
    )
  $$
    );
