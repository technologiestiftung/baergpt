-- Remove existing columns and add new name columns
ALTER TABLE profiles
DROP COLUMN IF EXISTS username,
DROP COLUMN IF EXISTS full_name,
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;

-- Update Row Level Security (RLS) policies in profiles table
DROP POLICY if EXISTS "Public profiles are viewable by everyone." ON profiles;

CREATE POLICY "Users can select their own profile." ON profiles FOR
SELECT
	USING (
		(
			SELECT
				auth.uid ()
		) = id
	);

-- This trigger needs to extract first_name and last_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user () returns trigger
SET
	search_path = '' AS $$
BEGIN
INSERT INTO public.profiles (id, first_name, last_name)
VALUES (
           new.id,
           (new.raw_user_meta_data->>'first_name'),
           (new.raw_user_meta_data->>'last_name')
       );
RETURN new;
END;
$$ language plpgsql security definer;
