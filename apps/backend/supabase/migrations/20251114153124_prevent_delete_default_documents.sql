-- Prevent deletion of default documents for all users (including admins)
DROP POLICY if EXISTS "Allow owners to delete documents and admins to delete base knowledge documents" ON public.documents;

CREATE POLICY "Allow owners to delete documents and admins to delete base knowledge documents" ON public.documents FOR delete TO authenticated USING (
	(
		owned_by_user_id = (
			SELECT
				auth.uid ()
		)
		OR (
			public.is_application_admin ()
			AND owned_by_user_id IS NULL
		)
	)
	AND source_type != 'default_document'
);
