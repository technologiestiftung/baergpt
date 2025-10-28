-- First, drop the existing foreign key constraint if it exists
ALTER TABLE documents
DROP CONSTRAINT if EXISTS documents_owner_user_id_fkey;

-- Add the new foreign key constraint with CASCADE DELETE
ALTER TABLE documents
ADD CONSTRAINT documents_owner_user_id_fkey FOREIGN key (owned_by_user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
