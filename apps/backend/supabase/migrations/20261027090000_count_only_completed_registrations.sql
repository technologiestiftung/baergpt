SET
    check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_registration_completed (user_meta_data JSONB) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE
SET
    search_path TO '' AS $function$
SELECT COALESCE(pg_catalog.btrim(user_meta_data->>'first_name'), '') <> ''
   AND COALESCE(pg_catalog.btrim(user_meta_data->>'last_name'), '') <> '';
$function$;

CREATE OR REPLACE FUNCTION public.get_users () RETURNS TABLE (
    user_id UUID,
    email TEXT,
    registered_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    invited_at TIMESTAMP WITH TIME ZONE,
    first_name TEXT,
    last_name TEXT,
    personal_title TEXT,
    num_documents INTEGER,
    num_inferences INTEGER,
    num_inference_tokens BIGINT,
    num_embedding_tokens BIGINT,
    academic_title TEXT,
    is_admin BOOLEAN,
    banned_until TIMESTAMP WITH TIME ZONE,
    is_registration_pending BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path TO '' AS $function$
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
    u.banned_until::timestamptz AS banned_until,
    NOT public.is_registration_completed(u.raw_user_meta_data) AS is_registration_pending
FROM auth.users u
         LEFT JOIN public.profiles p ON p.id = u.id
         LEFT JOIN public.application_admins a ON a.user_id = u.id
ORDER BY u.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_dashboard_stats () RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path TO '' AS $function$
DECLARE
v_result                            jsonb;
    v_daily_user_evolution              jsonb;
    v_dau                               bigint;
    v_wau                               bigint;
    v_mau                               bigint;
    v_domains                           jsonb;
    v_total_chats                       bigint;
    v_total_messages_with_documents     bigint;
    v_total_messages_without_documents  bigint;
    v_total_user_documents              bigint;
    v_average_inferences_per_user       numeric;
    v_base_user_count                   bigint;
    v_window_start  timestamptz := date_trunc('day', now()) - interval '29 days';
    v_window_end    timestamptz := date_trunc('day', now()) + interval '1 day';
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Access denied: requires application admin privileges';
END IF;

SELECT COUNT(*)
INTO v_base_user_count
FROM auth.users u
WHERE u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
  AND u.email_confirmed_at < v_window_start
  AND (u.banned_until IS NULL OR u.banned_until < now());

SELECT jsonb_agg(
           jsonb_build_object(
               'date', day,
               'total', v_base_user_count + cumulative_new,
               'new', new_users
           )
               ORDER BY day
       )
INTO v_daily_user_evolution
FROM (
         SELECT
             s.day,
             COALESCE(dn.new_users, 0) AS new_users,
             SUM(COALESCE(dn.new_users, 0)) OVER (
                ORDER BY s.day
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS cumulative_new
         FROM (
                  SELECT gs.day::date AS day
                  FROM generate_series(
                      v_window_start::date,
                      (v_window_end - interval '1 day')::date,
                      interval '1 day'
                      ) AS gs(day)
              ) s
                  LEFT JOIN (
             SELECT u.email_confirmed_at::date AS day, COUNT(*) AS new_users
             FROM auth.users u
             WHERE u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
               AND u.email_confirmed_at >= v_window_start
               AND u.email_confirmed_at < v_window_end
               AND (u.banned_until IS NULL OR u.banned_until < now())
             GROUP BY u.email_confirmed_at::date
         ) dn ON dn.day = s.day
     ) sub;

SELECT COUNT(*)
INTO v_dau
FROM auth.users u
WHERE u.last_sign_in_at >= now() - interval '1 day'
  AND u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
  AND (u.banned_until IS NULL OR u.banned_until < now());

SELECT COUNT(*)
INTO v_wau
FROM auth.users u
WHERE u.last_sign_in_at >= now() - interval '7 days'
  AND u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
  AND (u.banned_until IS NULL OR u.banned_until < now());

SELECT COUNT(*)
INTO v_mau
FROM auth.users u
WHERE u.last_sign_in_at >= now() - interval '30 days'
  AND u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
  AND (u.banned_until IS NULL OR u.banned_until < now());

SELECT jsonb_agg(
           jsonb_build_object('domain', domain, 'count', count)
               ORDER BY count DESC
       )
INTO v_domains
FROM (
         SELECT split_part(u.email, '@', 2) AS domain, COUNT(u.id) AS count
         FROM auth.users u
         WHERE u.email IS NOT NULL
           AND u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
           AND (u.banned_until IS NULL OR u.banned_until < now())
         GROUP BY split_part(u.email, '@', 2)
     ) sub;

SELECT COUNT(DISTINCT id)
INTO v_total_chats
FROM public.chats;

SELECT COUNT(*)
INTO v_total_messages_with_documents
FROM public.chat_messages cm
WHERE cardinality(COALESCE(cm.allowed_document_ids, '{}')) > 0
   OR cardinality(COALESCE(cm.allowed_folder_ids, '{}')) > 0;

SELECT COUNT(*)
INTO v_total_messages_without_documents
FROM public.chat_messages cm
WHERE cardinality(COALESCE(cm.allowed_document_ids, '{}')) = 0
  AND cardinality(COALESCE(cm.allowed_folder_ids, '{}')) = 0;

SELECT COUNT(*)
INTO v_total_user_documents
FROM public.documents d
WHERE d.source_type = 'personal_document';

SELECT COALESCE(
           (SELECT COUNT(*)
            FROM public.chat_messages cm
                     JOIN public.chats c ON cm.chat_id = c.id
                     JOIN auth.users u ON c.user_id = u.id
            WHERE cm.role = 'user'
              AND u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
              AND (u.banned_until IS NULL OR u.banned_until < now())
           )::numeric
               / NULLIF((
                            SELECT COUNT(*)
                            FROM auth.users u
                            WHERE u.email_confirmed_at IS NOT NULL AND public.is_registration_completed(u.raw_user_meta_data)
                              AND (u.banned_until IS NULL OR u.banned_until < now())
                        ), 0),
           0
       )
INTO v_average_inferences_per_user;

v_result := jsonb_build_object(
        'daily_user_evolution',             COALESCE(v_daily_user_evolution, '[]'::jsonb),
        'dau',                              v_dau,
        'wau',                              v_wau,
        'mau',                              v_mau,
        'domains',                          COALESCE(v_domains, '[]'::jsonb),
        'total_chats',                      v_total_chats,
        'total_messages_with_documents',    v_total_messages_with_documents,
        'total_messages_without_documents', v_total_messages_without_documents,
        'total_user_documents',             v_total_user_documents,
        'average_inferences_per_user',      v_average_inferences_per_user
    );

RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") IS 'A registration is completed once first and last name are set in the user metadata. The frontend uses the same rule (hasCompletedRegistration).';

GRANT ALL ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") TO "service_role";
