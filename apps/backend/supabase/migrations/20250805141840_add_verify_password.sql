CREATE OR REPLACE FUNCTION verify_own_password ("plain_password" TEXT) returns BOOLEAN language plpgsql security definer
SET
	search_path = '' AS $$
DECLARE 
  stored_password auth.users.encrypted_password %TYPE;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT encrypted_password INTO stored_password
  FROM auth.users
  WHERE id = current_user_id;

  IF stored_password IS NULL THEN 
    RETURN FALSE;
  END IF;
    -- crypt(plain_password, stored_password) salts and hashes plain_password using the salt from stored_password
    -- using digest_compare to compare the two bytea values as a defense against timing attacks
  RETURN stored_password = extensions.crypt(plain_password, stored_password);
END;
$$;

-- Allow authenticated users to call this
GRANT
EXECUTE ON function verify_own_password (TEXT) TO authenticated;
