-- The pg_hashids extension was previously used for generating short IDs via the generate_short_id() trigger function,
-- which was attached to the user_requests table. The user_requests table has since been dropped, and the function is now unused.
DROP EXTENSION if EXISTS pg_hashids;

DROP FUNCTION if EXISTS public.generate_short_id ();
