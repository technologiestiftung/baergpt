-- Update token counters to bigint to prevent overflow
ALTER TABLE profiles
ALTER COLUMN num_inference_tokens type BIGINT;

ALTER TABLE profiles
ALTER COLUMN num_embedding_tokens type BIGINT;

-- Update get_users function to use bigint
DROP FUNCTION IF EXISTS public.get_users ();

CREATE FUNCTION public.get_users () returns TABLE (
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
    -- ensure caller is an admin
    IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
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
