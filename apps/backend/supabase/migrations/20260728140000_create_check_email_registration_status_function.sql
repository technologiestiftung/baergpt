-- Looks up whether an email is already registered and, if so, whether it's confirmed.
-- Used by POST /auth/register to decide whether to create a new user, resend the
-- signup confirmation, or send a password reset, without leaking existence/
-- confirmation state to unprivileged callers.
CREATE OR REPLACE FUNCTION public.check_email_registration_status (p_email TEXT) RETURNS TABLE (user_exists BOOLEAN, is_confirmed BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
DECLARE
  v_confirmed_at timestamptz;
  v_found boolean;
BEGIN
  SELECT u.email_confirmed_at INTO v_confirmed_at
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  v_found := FOUND;

  RETURN QUERY SELECT v_found, (v_found AND v_confirmed_at IS NOT NULL);
END;
$$;

REVOKE
EXECUTE ON FUNCTION public.check_email_registration_status (TEXT)
FROM
    PUBLIC;

REVOKE
EXECUTE ON FUNCTION public.check_email_registration_status (TEXT)
FROM
    anon;

REVOKE
EXECUTE ON FUNCTION public.check_email_registration_status (TEXT)
FROM
    authenticated;

GRANT
EXECUTE ON FUNCTION public.check_email_registration_status (TEXT) TO service_role;
