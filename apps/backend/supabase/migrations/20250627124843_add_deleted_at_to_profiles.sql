-- Add deleted_at column to profiles table for soft delete functionality
ALTER TABLE public.profiles
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

comment ON COLUMN public.profiles.deleted_at IS 'Timestamp when the profile was soft deleted. NULL means the profile is active.';

-- Create an index on deleted_at for efficient queries
CREATE INDEX idx_profiles_deleted_at ON public.profiles (deleted_at)
WHERE
	deleted_at IS NOT NULL;

-- Update RLS policies to exclude soft-deleted profiles from normal queries
-- Drop existing policy first
DROP POLICY if EXISTS "Users can select their own profile." ON public.profiles;

-- Recreate policy with deleted_at check
CREATE POLICY "Users can select their own profile." ON public.profiles FOR
SELECT
	USING (
		(auth.uid () = id)
		AND (deleted_at IS NULL)
	);

-- Add policy to allow authenticated users to access profiles
CREATE POLICY "Allow authenticated users to access profiles" ON public.profiles FOR
SELECT
	USING (auth.uid () = id);

-- Add cron job to delete soft-deleted profiles after 30 days
-- Ensure pg_cron extension is installed and configured
CREATE EXTENSION if NOT EXISTS pg_cron
WITH
	schema pg_catalog;

GRANT usage ON schema cron TO postgres;

GRANT ALL privileges ON ALL tables IN schema cron TO postgres;

SELECT
	cron.schedule (
		'delete-expired-users',
		'0 3 * * *', -- Daily at 3 AM
		$$
  DELETE FROM auth.users 
  WHERE id IN (
    SELECT id 
    FROM public.profiles 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days'
  );
  $$
	);
