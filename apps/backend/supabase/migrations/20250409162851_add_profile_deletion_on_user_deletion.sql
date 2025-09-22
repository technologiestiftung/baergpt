-- Drop the existing foreign key constraint on profiles.id
ALTER TABLE profiles
DROP CONSTRAINT if EXISTS profiles_id_fkey;

-- Recreate the foreign key constraint with ON DELETE CASCADE
ALTER TABLE profiles
ADD CONSTRAINT profiles_id_fkey FOREIGN key (id) REFERENCES auth.users (id) ON DELETE CASCADE;
