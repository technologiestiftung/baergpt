REVOKE
EXECUTE ON FUNCTION update_user_email_confirmed_at (UUID, TIMESTAMPTZ)
FROM
    anon;

REVOKE
EXECUTE ON FUNCTION update_user_last_sign_in_at (UUID, TIMESTAMPTZ)
FROM
    anon;
