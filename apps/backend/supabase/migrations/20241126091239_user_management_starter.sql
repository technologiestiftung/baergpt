-- Create a table for public profiles
CREATE TABLE profiles (
	id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
	updated_at TIMESTAMP WITH TIME ZONE,
	username TEXT UNIQUE,
	full_name TEXT,
	CONSTRAINT username_length CHECK (CHAR_LENGTH(username) >= 3)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/database/postgres/row-level-security for more details.
ALTER TABLE profiles enable ROW level security;

CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR
SELECT
	USING (TRUE);

CREATE POLICY "Users can insert their own profile." ON profiles FOR insert
WITH
	CHECK (
		(
			SELECT
				auth.uid ()
		) = id
	);

CREATE POLICY "Users can update own profile." ON profiles
FOR UPDATE
	USING (
		(
			SELECT
				auth.uid ()
		) = id
	);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
CREATE FUNCTION public.handle_new_user () returns trigger
SET
	search_path = '' AS $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

CREATE TRIGGER on_auth_user_created
AFTER insert ON auth.users FOR each ROW
EXECUTE procedure public.handle_new_user ();
