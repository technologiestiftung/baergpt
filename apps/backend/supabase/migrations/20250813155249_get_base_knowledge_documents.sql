-- Function to get base knowledge documents for a user with all parent access groups
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
    -- or if they have admin privileges
    IF input_user_id != auth.uid() AND NOT EXISTS (
        SELECT 1 FROM public.application_admins 
        WHERE user_id = auth.uid()
    ) THEN
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
        WHERE d.owned_by_user_id IS NULL  -- Only use base knowledge documents
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
