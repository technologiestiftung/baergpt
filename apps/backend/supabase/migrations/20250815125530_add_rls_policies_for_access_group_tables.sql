-- Enable RLS
ALTER TABLE public.access_groups enable ROW level security;

ALTER TABLE public.access_group_members enable ROW level security;

-- Single SELECT policy granting read access to everyone
CREATE POLICY access_groups_select_all ON public.access_groups FOR
SELECT
	USING (TRUE);

-- INSERT (admins)
CREATE POLICY access_groups_insert_admin ON public.access_groups FOR insert
WITH
	CHECK (
		EXISTS (
			SELECT
				1
			FROM
				public.application_admins a
			WHERE
				a.user_id = (
					SELECT
						auth.uid ()
				)
		)
	);

-- UPDATE (admins)
CREATE POLICY access_groups_update_admin ON public.access_groups
FOR UPDATE
	USING (
		EXISTS (
			SELECT
				1
			FROM
				public.application_admins a
			WHERE
				a.user_id = (
					SELECT
						auth.uid ()
				)
		)
	)
WITH
	CHECK (
		EXISTS (
			SELECT
				1
			FROM
				public.application_admins a
			WHERE
				a.user_id = (
					SELECT
						auth.uid ()
				)
		)
	);

-- DELETE (admins)
CREATE POLICY access_groups_delete_admin ON public.access_groups FOR delete USING (
	EXISTS (
		SELECT
			1
		FROM
			public.application_admins a
		WHERE
			a.user_id = (
				SELECT
					auth.uid ()
			)
	)
);

-- SELECT: admins can see all rows; regular users only their own
CREATE POLICY access_group_members_select ON public.access_group_members FOR
SELECT
	USING (
		(
			EXISTS (
				SELECT
					1
				FROM
					public.application_admins a
				WHERE
					a.user_id = (
						SELECT
							auth.uid ()
					)
			)
		)
		OR user_id = (
			SELECT
				auth.uid ()
		)
	);

-- INSERT (admins)
CREATE POLICY access_group_members_insert_admin ON public.access_group_members FOR insert
WITH
	CHECK (
		EXISTS (
			SELECT
				1
			FROM
				public.application_admins a
			WHERE
				a.user_id = (
					SELECT
						auth.uid ()
				)
		)
	);

-- UPDATE (admins)
CREATE POLICY access_group_members_update_admin ON public.access_group_members
FOR UPDATE
	USING (
		EXISTS (
			SELECT
				1
			FROM
				public.application_admins a
			WHERE
				a.user_id = (
					SELECT
						auth.uid ()
				)
		)
	)
WITH
	CHECK (
		EXISTS (
			SELECT
				1
			FROM
				public.application_admins a
			WHERE
				a.user_id = (
					SELECT
						auth.uid ()
				)
		)
	);

-- DELETE (admins)
CREATE POLICY access_group_members_delete_admin ON public.access_group_members FOR delete USING (
	EXISTS (
		SELECT
			1
		FROM
			public.application_admins a
		WHERE
			a.user_id = (
				SELECT
					auth.uid ()
			)
	)
);
