CREATE FUNCTION change_value_for_user_by (amount INT, column_name TEXT, user_id_to_update UUID) returns void AS $$
BEGIN
  EXECUTE format('UPDATE profiles SET %I = %I + $1 WHERE id = $2', column_name, column_name)
  USING amount, user_id_to_update;
END;
$$ language plpgsql;

ALTER TABLE profiles
RENAME COLUMN num_messages TO num_inferences;

ALTER TABLE profiles
RENAME COLUMN num_tokens TO num_inference_tokens;

ALTER TABLE profiles
ADD COLUMN num_embedding_tokens INT DEFAULT 0;

ALTER TABLE profiles
DROP COLUMN registered_at;

ALTER TABLE profiles
DROP COLUMN last_login_at;

ALTER TABLE profiles
DROP COLUMN updated_at;
