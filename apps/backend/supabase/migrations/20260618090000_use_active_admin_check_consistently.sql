-- Several policies/functions inlined the application_admins check instead of
-- calling is_application_admin(), so they bypassed the active-status check
-- added to that function. Switch them all to call the function so
-- deactivated admins lose access here too.
-- access_groups
ALTER POLICY access_groups_insert_admin ON public.access_groups
WITH
    CHECK (public.is_application_admin ());

ALTER POLICY access_groups_update_admin ON public.access_groups USING (public.is_application_admin ())
WITH
    CHECK (public.is_application_admin ());

ALTER POLICY access_groups_delete_admin ON public.access_groups USING (public.is_application_admin ());

-- access_group_members
ALTER POLICY access_group_members_select ON public.access_group_members USING (
    public.is_application_admin ()
    OR user_id = (
        SELECT
            auth.uid ()
    )
);

ALTER POLICY access_group_members_insert_admin ON public.access_group_members
WITH
    CHECK (public.is_application_admin ());

ALTER POLICY access_group_members_update_admin ON public.access_group_members USING (public.is_application_admin ())
WITH
    CHECK (public.is_application_admin ());

ALTER POLICY access_group_members_delete_admin ON public.access_group_members USING (public.is_application_admin ());

-- get_users(): called directly from the admin panel via supabase.rpc,
-- bypassing the backend's adminAuth middleware entirely.
CREATE OR REPLACE FUNCTION public.get_users () returns TABLE (
    user_id UUID,
    email TEXT,
    registered_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    invited_at TIMESTAMPTZ,
    first_name TEXT,
    last_name TEXT,
    personal_title TEXT,
    num_documents INT,
    num_inferences INT,
    num_inference_tokens BIGINT,
    num_embedding_tokens BIGINT,
    academic_title TEXT,
    is_admin BOOLEAN,
    is_active BOOLEAN,
    deleted_at TIMESTAMPTZ
) language plpgsql security definer
SET
    search_path = '' AS $$
BEGIN
    -- ensure caller is an active admin
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
    END IF;

    RETURN QUERY
    SELECT
        u.id::uuid,
        u.email::text,
        u.created_at::timestamptz,
        u.last_sign_in_at::timestamptz,
        u.invited_at::timestamptz,
        p.first_name::text,
        p.last_name::text,
        p.personal_title::text,
        COALESCE(p.num_documents, 0)::int,
        COALESCE(p.num_inferences, 0)::int,
        COALESCE(p.num_inference_tokens, 0)::bigint,
        COALESCE(p.num_embedding_tokens, 0)::bigint,
        p.academic_title::text,
        (CASE WHEN a.user_id IS NOT NULL THEN TRUE ELSE FALSE END) AS is_admin,
        COALESCE(uas.is_active, FALSE)::boolean,
        uas.deleted_at::timestamptz
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.application_admins a ON a.user_id = u.id
    LEFT JOIN public.user_active_status uas ON uas.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

GRANT
EXECUTE ON function public.get_users () TO authenticated;

-- get_base_knowledge_documents(): callable directly by any authenticated
-- client via supabase-js, independent of any backend route.
CREATE OR REPLACE FUNCTION get_base_knowledge_documents (input_user_id UUID) returns TABLE (
    id INTEGER,
    folder_id INTEGER,
    created_at TIMESTAMPTZ,
    file_name TEXT,
    short_summary TEXT,
    tags TEXT[]
) language plpgsql security invoker
SET
    search_path = '' AS $$
BEGIN
    -- Security check: Only allow users to access their own documents
    -- or if they have active admin privileges
    IF input_user_id != auth.uid() AND NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Access denied: You can only access your own documents';
    END IF;
    -- Use a recursive CTE to find all parent access groups and then join with documents and summaries
    RETURN QUERY
    WITH RECURSIVE user_access_groups AS (
        -- Base case: Get the user's direct access group
        SELECT agm.access_group_id as id
        FROM public.access_group_members agm
        WHERE agm.user_id = input_user_id

        UNION

        -- Recursive case: Get all parent access groups (groups that contain the current groups)
        SELECT ag.id
        FROM public.access_groups ag
        INNER JOIN user_access_groups uag ON ag.subset_of = uag.id
    ),
    accessible_documents AS (
        -- Get all documents accessible to the user's access groups
        SELECT d.id, d.folder_id, d.created_at, d.file_name
        FROM public.documents d
        INNER JOIN user_access_groups uag ON d.access_group_id = uag.id
        WHERE d.owned_by_user_id IS NULL AND d.source_type = 'public_document'  -- Only use base knowledge documents
    )
    SELECT
        ad.id,
        ad.folder_id,
        ad.created_at,
        ad.file_name,
        ds.short_summary,
        COALESCE(ds.tags, ARRAY[]::TEXT[]) as tags
    FROM accessible_documents ad
    LEFT JOIN public.document_summaries ds ON ad.id = ds.document_id
    ORDER BY ad.created_at DESC;
END;
$$;
