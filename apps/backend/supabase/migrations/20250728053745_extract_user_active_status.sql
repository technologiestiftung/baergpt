-- Create a new table to store user active status
CREATE TABLE user_active_status (
	id UUID NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
	is_active BOOLEAN DEFAULT TRUE NOT NULL,
	deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Add a comment to the table
comment ON TABLE user_active_status IS 'Stores user active status and deletion information';

-- Enable row-level security on the new table; no user should be able to access this table directly
ALTER TABLE user_active_status enable ROW level security;

-- Update the handle_new_user function to insert the new user into the user_active_status table
CREATE OR REPLACE FUNCTION public.handle_new_user () returns trigger language plpgsql security definer
SET
	search_path = '' AS $$
BEGIN
    -- Insert into profiles table
    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');

    -- Insert into user_active_status table
    INSERT INTO public.user_active_status (id, is_active, deleted_at)
    VALUES (new.id, TRUE, NULL);

    RETURN new;
END;
$$;

-- Create function to check if the current user is active
CREATE OR REPLACE FUNCTION public.is_current_user_active () returns BOOLEAN language plpgsql
SET
	search_path = '' security definer AS $$
DECLARE
    isActive BOOLEAN;
BEGIN
    SELECT is_active
    INTO isActive
    FROM public.user_active_status
    WHERE id = (select auth.uid());

    RETURN COALESCE(isActive, FALSE);
END;
$$;

comment ON function is_current_user_active IS 'Returns whether the current user is active based on their is_active status';

-- Copy existing data from profiles table to the new table
INSERT INTO
	user_active_status (id, is_active, deleted_at)
SELECT
	id,
	is_active,
	deleted_at
FROM
	profiles;

-- Update the profiles policy to no longer use deleted_at
ALTER POLICY "Allow authenticated users to access own profile" ON profiles USING (
	(
		(
			SELECT
				auth.uid ()
		) = id
	)
	AND (
		SELECT
			is_current_user_active () IS TRUE
	)
);

-- Remove columns from profiles table
ALTER TABLE profiles
DROP COLUMN is_active,
DROP COLUMN deleted_at;

-- Create index on is_active for performance
CREATE INDEX idx_user_active_status_is_active ON user_active_status (is_active);

-- Create index on deleted_at for performance
CREATE INDEX idx_user_active_status_deleted_at ON user_active_status (deleted_at);

-- Update the cronjob to delete soft-deleted profiles after 30 days using the new user_active_status table
SELECT
	cron.unschedule ('delete-expired-users');

SELECT
	cron.schedule (
		'delete-expired-users',
		'0 3 * * *', -- Daily at 3 AM
		$$ DELETE FROM auth.users
      WHERE id IN (
        SELECT id
        FROM public.user_active_status
        WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days'
      );
    $$
	);
