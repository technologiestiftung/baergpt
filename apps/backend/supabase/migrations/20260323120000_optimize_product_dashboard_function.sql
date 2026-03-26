CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON public.chat_messages (role);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages (chat_id);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats (user_id);

CREATE INDEX IF NOT EXISTS idx_documents_source_type ON public.documents (source_type);

CREATE OR REPLACE FUNCTION public.get_product_dashboard_stats () RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
DECLARE
  v_result jsonb;
  v_daily_user_evolution jsonb;
  v_dau bigint;
  v_wau bigint;
  v_mau bigint;
  v_domains jsonb;
  v_total_chats bigint;
  v_total_messages_with_documents bigint;
  v_total_messages_without_documents bigint;
  v_total_user_documents bigint;
  v_average_inferences_per_user numeric;
  v_base_user_count bigint;
  v_window_start timestamptz := date_trunc('day', now()) - interval '29 days';
  v_window_end   timestamptz := date_trunc('day', now()) + interval '1 day';
BEGIN

IF NOT public.is_application_admin() THEN
    RAISE EXCEPTION 'Access denied: requires application admin privileges';
END IF;

SELECT COUNT(*)
INTO v_base_user_count
FROM auth.users u
JOIN public.user_active_status uas ON uas.id = u.id
WHERE u.email_confirmed_at IS NOT NULL
  AND u.email_confirmed_at < v_window_start
  AND uas.is_active = true
  AND uas.deleted_at IS NULL;

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
        -- Group confirmed users by day — produces at most 30 rows.
        SELECT
            u.email_confirmed_at::date AS day,
            COUNT(*) AS new_users
        FROM auth.users u
        JOIN public.user_active_status uas ON uas.id = u.id
        WHERE u.email_confirmed_at IS NOT NULL
          AND u.email_confirmed_at >= v_window_start
          AND u.email_confirmed_at < v_window_end
          AND uas.is_active = true
          AND uas.deleted_at IS NULL
        GROUP BY u.email_confirmed_at::date
    ) dn ON dn.day = s.day
) sub;

SELECT COUNT(*)
INTO v_dau
FROM auth.users u
         JOIN public.user_active_status uas ON uas.id = u.id
WHERE u.last_sign_in_at >= now() - interval '1 day'
  AND u.email_confirmed_at IS NOT NULL
  AND uas.is_active = true
  AND uas.deleted_at IS NULL;

SELECT COUNT(*)
INTO v_wau
FROM auth.users u
         JOIN public.user_active_status uas ON uas.id = u.id
WHERE u.last_sign_in_at >= now() - interval '7 days'
  AND u.email_confirmed_at IS NOT NULL
  AND uas.is_active = true
  AND uas.deleted_at IS NULL;

SELECT COUNT(*)
INTO v_mau
FROM auth.users u
         JOIN public.user_active_status uas ON uas.id = u.id
WHERE u.last_sign_in_at >= now() - interval '30 days'
  AND u.email_confirmed_at IS NOT NULL
  AND uas.is_active = true
  AND uas.deleted_at IS NULL;

SELECT jsonb_agg(
           jsonb_build_object(
               'domain', domain,
               'count', count
           )
               ORDER BY count DESC
       )
INTO v_domains
FROM (
         SELECT
             split_part(u.email, '@', 2) AS domain,
        COUNT(u.id) AS count
         FROM auth.users u
             JOIN public.user_active_status uas ON uas.id = u.id
         WHERE u.email IS NOT NULL
           AND u.email_confirmed_at IS NOT NULL
           AND uas.is_active = true
           AND uas.deleted_at IS NULL
         GROUP BY split_part(u.email, '@', 2)
     ) sub;

SELECT COUNT(*)
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
             JOIN public.user_active_status uas ON uas.id = u.id
             WHERE cm.role = 'user'
               AND u.email_confirmed_at IS NOT NULL
               AND uas.is_active = true
               AND uas.deleted_at IS NULL
            )::numeric
            / NULLIF((
                    SELECT COUNT(*)
                    FROM auth.users u
                    JOIN public.user_active_status uas ON uas.id = u.id
                    WHERE u.email_confirmed_at IS NOT NULL
                      AND uas.is_active = true
                      AND uas.deleted_at IS NULL
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
$$;

REVOKE
EXECUTE ON FUNCTION get_product_dashboard_stats ()
FROM
    PUBLIC,
    service_role;

GRANT
EXECUTE ON FUNCTION public.get_product_dashboard_stats () TO authenticated;
