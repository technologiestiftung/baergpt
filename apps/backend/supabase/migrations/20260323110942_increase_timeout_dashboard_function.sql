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
BEGIN

IF NOT public.is_application_admin() THEN
    RAISE EXCEPTION 'Access denied: requires application admin privileges';
END IF;

SET LOCAL statement_timeout = '60s';

-- Cumulative total users per day over the last 30 days
SELECT jsonb_agg(
           jsonb_build_object(
               'date', day::date,
               'total', total_users,
               'new', new_users
           )
               ORDER BY day
       )
INTO v_daily_user_evolution
FROM (
         SELECT
             gs.day,
             COUNT(DISTINCT all_users.id) AS total_users,
             COUNT(DISTINCT new_users.id) AS new_users
         FROM generate_series(
                  (now() - interval '29 days')::date,
                  now()::date,
                  interval '1 day'
              ) AS gs(day)
                  LEFT JOIN (
             SELECT u.id, u.email_confirmed_at
             FROM auth.users u
                      JOIN public.user_active_status uas ON uas.id = u.id
             WHERE u.email_confirmed_at IS NOT NULL
               AND uas.is_active = true
               AND uas.deleted_at IS NULL
         ) all_users ON all_users.email_confirmed_at::date <= gs.day::date
         LEFT JOIN (
             SELECT u.id, u.email_confirmed_at
             FROM auth.users u
             JOIN public.user_active_status uas ON uas.id = u.id
             WHERE u.email_confirmed_at::date IS NOT NULL
             AND uas.is_active = true
             AND uas.deleted_at IS NULL
         ) new_users ON new_users.email_confirmed_at::date = gs.day::date
         GROUP BY gs.day
     ) sub;

-- Daily Active Users (DAU): users who signed in in the last 24 hours
SELECT COUNT(DISTINCT u.id)
INTO v_dau
FROM auth.users u
         JOIN public.user_active_status uas ON uas.id = u.id
WHERE u.last_sign_in_at >= now() - interval '1 day'
  AND u.email_confirmed_at IS NOT NULL
  AND uas.is_active = true
  AND uas.deleted_at IS NULL;

-- Weekly Active Users (WAU): users who signed in  in the last 7 days
SELECT COUNT(DISTINCT u.id)
INTO v_wau
FROM auth.users u
         JOIN public.user_active_status uas ON uas.id = u.id
WHERE u.last_sign_in_at >= now() - interval '7 days'
  AND u.email_confirmed_at IS NOT NULL
  AND uas.is_active = true
  AND uas.deleted_at IS NULL;

-- Monthly Active Users (MAU): users who signed in  in the last 30 days
SELECT COUNT(DISTINCT u.id)
INTO v_mau
FROM auth.users u
         JOIN public.user_active_status uas ON uas.id = u.id
WHERE u.last_sign_in_at >= now() - interval '30 days'
  AND u.email_confirmed_at IS NOT NULL
  AND uas.is_active = true
  AND uas.deleted_at IS NULL;

-- Email domains with their user count, ordered by count descending
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


-- Total Chats
SELECT COUNT(DISTINCT id)
INTO v_total_chats
FROM public.chats;

-- Total Messages with Documents
SELECT COUNT(*)
INTO v_total_messages_with_documents
FROM public.chat_messages cm
WHERE cardinality(cm.allowed_document_ids) > 0
   OR cardinality(cm.allowed_folder_ids) > 0;

-- Total Messages without Documents
SELECT COUNT(*)
INTO v_total_messages_without_documents
FROM public.chat_messages cm
WHERE cardinality(cm.allowed_document_ids) = 0
  AND cardinality(cm.allowed_folder_ids) = 0;

-- Total User Documents
SELECT COUNT(DISTINCT d.id)
INTO v_total_user_documents
FROM public.documents d
WHERE d.source_type = 'personal_document';

-- Average Inferences per User (numerator and denominator use same filtered user set)
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
                            SELECT COUNT(DISTINCT u.id)
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
