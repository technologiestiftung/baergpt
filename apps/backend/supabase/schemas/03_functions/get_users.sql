CREATE OR REPLACE FUNCTION "public"."get_users" () RETURNS TABLE (
    "user_id" "uuid",
    "email" "text",
    "registered_at" TIMESTAMP WITH TIME ZONE,
    "last_login_at" TIMESTAMP WITH TIME ZONE,
    "invited_at" TIMESTAMP WITH TIME ZONE,
    "first_name" "text",
    "last_name" "text",
    "personal_title" "text",
    "num_documents" INTEGER,
    "num_inferences" INTEGER,
    "num_inference_tokens" BIGINT,
    "num_embedding_tokens" BIGINT,
    "academic_title" "text",
    "is_admin" BOOLEAN,
    "banned_until" TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
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
    u.banned_until::timestamptz AS banned_until
FROM auth.users u
         LEFT JOIN public.profiles p ON p.id = u.id
         LEFT JOIN public.application_admins a ON a.user_id = u.id
ORDER BY u.created_at DESC;
END;
$$;

ALTER FUNCTION "public"."get_users" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_users" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_users" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_users" () TO "service_role";
