-- ─── 1. Migrate existing banned users to auth.users.banned_until ──────────────
-- Users who are inactive get banned until far future.
-- Supabase does not expose a direct UPDATE on auth.users from SQL in migrations,
-- so we use the auth.users table directly (available to postgres role).
DO $$
BEGIN
IF to_regclass('public.user_active_status') IS NOT NULL THEN
    UPDATE auth.users
    SET banned_until = '2099-01-01 00:00:00+00'
    WHERE id IN (
        SELECT id
        FROM public.user_active_status
        WHERE is_active = FALSE
    );
END IF;
END;
$$;

-- ─── 2. Drop the cron job ─────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'delete-expired-users'
    ) THEN
        PERFORM cron.unschedule('delete-expired-users');
END IF;
END;
$$;

-- ─── 3. Rewrite handle_new_user — remove insert into user_active_status ───────
CREATE OR REPLACE FUNCTION public.handle_new_user () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
BEGIN
INSERT INTO public.profiles (id, first_name, last_name)
VALUES (
           new.id,
           new.raw_user_meta_data->>'first_name',
           new.raw_user_meta_data->>'last_name'
       );
RETURN new;
END;
$$;

-- ─── 4. Returns TRUE if the current caller is banned (banned_until in the future).
-- Mirrors Supabase's own "banned" semantics: banned_until IS NOT NULL AND banned_until > now().
CREATE OR REPLACE FUNCTION public.is_current_user_banned () RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER
SET
    search_path = '' AS $$
SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.banned_until IS NOT NULL
      AND u.banned_until > now()
);
$$;

COMMENT ON FUNCTION public.is_current_user_banned () IS 'Returns TRUE if the current user is banned (auth.users.banned_until in the future).';

REVOKE
EXECUTE ON FUNCTION public.is_current_user_banned ()
FROM
    PUBLIC;

GRANT
EXECUTE ON FUNCTION public.is_current_user_banned () TO authenticated,
anon;

-- ─── 5. update is_application_admin ──────────────────────────────────────────
-- Remove the is_current_user_active() call
-- since Supabase rejects banned users at the JWT layer before this is ever reached
CREATE OR REPLACE FUNCTION public.is_application_admin () RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER
SET
    search_path = '' AS $$
SELECT
    EXISTS (SELECT 1 FROM public.application_admins WHERE user_id = auth.uid())
    AND NOT (SELECT public.is_current_user_banned());
$$;

-- ─── 6. Rewrite deactivate_allowed_domain — use auth.users.banned_until ───────
CREATE OR REPLACE FUNCTION public.deactivate_allowed_domain (p_domain TEXT) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = ''
SET
    statement_timeout TO '60000' AS $$
DECLARE
v_domain TEXT;
    v_count  INTEGER;
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

UPDATE public.allowed_email_domains
SET is_active            = false,
    last_status_change_at = now(),
    last_status_change_by = auth.uid()
WHERE lower(domain) = lower(p_domain)
    RETURNING lower(domain) INTO v_domain;

IF v_domain IS NULL THEN
        RAISE EXCEPTION 'Allowed domain % not found', p_domain;
END IF;

    -- Ban affected users indefinitely (pure deactivation, no deletion).
WITH affected AS (
UPDATE auth.users
SET banned_until = '2099-01-01 00:00:00+00'
WHERE (banned_until IS NULL OR banned_until < now())
  AND lower(split_part(email, '@', 2)) = v_domain
RETURNING id
)
SELECT count(*) INTO v_count FROM affected;

RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.deactivate_allowed_domain (TEXT) IS 'Deactivates a domain and bans affected users via auth.users.banned_until.';

-- ─── 7. Rewrite get_product_dashboard_stats — remove JOIN on user_active_status
-- "active" = not banned: banned_until IS NULL OR banned_until < now()
CREATE OR REPLACE FUNCTION public.get_product_dashboard_stats () RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
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
WHERE u.email_confirmed_at IS NOT NULL
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
             WHERE u.email_confirmed_at IS NOT NULL
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
  AND u.email_confirmed_at IS NOT NULL
  AND (u.banned_until IS NULL OR u.banned_until < now());

SELECT COUNT(*)
INTO v_wau
FROM auth.users u
WHERE u.last_sign_in_at >= now() - interval '7 days'
  AND u.email_confirmed_at IS NOT NULL
  AND (u.banned_until IS NULL OR u.banned_until < now());

SELECT COUNT(*)
INTO v_mau
FROM auth.users u
WHERE u.last_sign_in_at >= now() - interval '30 days'
  AND u.email_confirmed_at IS NOT NULL
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
           AND u.email_confirmed_at IS NOT NULL
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
              AND u.email_confirmed_at IS NOT NULL
              AND (u.banned_until IS NULL OR u.banned_until < now())
           )::numeric
               / NULLIF((
                            SELECT COUNT(*)
                            FROM auth.users u
                            WHERE u.email_confirmed_at IS NOT NULL
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
$$;

REVOKE
EXECUTE ON FUNCTION get_product_dashboard_stats ()
FROM
    PUBLIC,
    service_role;

GRANT
EXECUTE ON FUNCTION public.get_product_dashboard_stats () TO authenticated;

-- ─── 8. Rewrite get_users — remove JOIN on user_active_status
DROP FUNCTION IF EXISTS public.get_users ();

CREATE FUNCTION public.get_users () RETURNS TABLE (
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
    banned_until TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '' AS $$
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

GRANT
EXECUTE ON FUNCTION public.get_users () TO authenticated;

-- ─── 9. Drop the table (and its indexes + policies) ──────────────────────────
DROP INDEX IF EXISTS public.idx_user_active_status_is_active;

DROP INDEX IF EXISTS public.idx_user_active_status_deleted_at;

DROP TABLE IF EXISTS public.user_active_status;

-- ─── 10. Add a banned-user check to every RLS policy that authorizes a user by
-- matching auth.uid() against an owner / user_id column. Banned users
-- (auth.users.banned_until in the future) are cut off from direct table and
-- storage access, complementing the JWT-layer rejection on refresh.
--
-- Policies gated solely by public.is_application_admin() already inherit the
-- ban check (that function now ANDs NOT is_current_user_banned()), so they are
-- left untouched.
-- ─── 10.1 access_group_members ────────────────────────────────────────────────────────────────────
ALTER POLICY access_group_members_select ON public.access_group_members USING (
    (
        public.is_application_admin ()
        OR (
            user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
    )
);

-- ─── 10.2 chats ────────────────────────────────────────────────────────────────────
ALTER POLICY "Allow authenticated users to CRUD their own chats" ON public.chats USING (
    (
        SELECT
            auth.uid ()
    ) = user_id
    AND NOT public.is_current_user_banned ()
)
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) = user_id
        AND NOT public.is_current_user_banned ()
    );

-- ─── 10.3 chat_messages ────────────────────────────────────────────────────────────
ALTER POLICY "Allow authenticated users to CRUD their own chat_messages" ON public.chat_messages USING (
    EXISTS (
        SELECT
            1
        FROM
            public.chats
        WHERE
            chats.id = chat_messages.chat_id
            AND chats.user_id = (
                SELECT
                    auth.uid ()
            )
    )
    AND NOT public.is_current_user_banned ()
)
WITH
    CHECK (
        EXISTS (
            SELECT
                1
            FROM
                public.chats
            WHERE
                chats.id = chat_messages.chat_id
                AND chats.user_id = (
                    SELECT
                        auth.uid ()
                )
        )
        AND NOT public.is_current_user_banned ()
    );

-- ─── 10.4 document_folders ─────────────────────────────────────────────────────────
ALTER POLICY "Allow authenticated users to CRUD their own document_folders" ON public.document_folders USING (
    (
        SELECT
            auth.uid ()
    ) = user_id
    AND NOT public.is_current_user_banned ()
)
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) = user_id
        AND NOT public.is_current_user_banned ()
    );

-- ─── 10.5 favorite_documents ───────────────────────────────────────────────────────
ALTER POLICY "Allow authenticated users to CRUD their own rows" ON public.favorite_documents USING (
    (
        SELECT
            auth.uid ()
    ) = user_id
    AND NOT public.is_current_user_banned ()
)
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) = user_id
        AND NOT public.is_current_user_banned ()
    );

-- ─── 10.6 document_chunks ──────────────────────────────────────────────────────────
ALTER POLICY "Allow authenticated users to access own or public document_chun" ON public.document_chunks USING (
    (
        owned_by_user_id IS NULL
        OR owned_by_user_id = (
            SELECT
                auth.uid ()
        )
    )
    AND NOT public.is_current_user_banned ()
)
WITH
    CHECK (
        (
            (
                owned_by_user_id = (
                    SELECT
                        auth.uid ()
                )
                AND NOT public.is_current_user_banned ()
            )
            OR (
                public.is_application_admin ()
                AND owned_by_user_id IS NULL
            )
        )
    );

-- ─── 10.7 document_summaries ───────────────────────────────────────────────────────
ALTER POLICY "Allow authenticated users to access own or public document_summ" ON public.document_summaries USING (
    (
        owned_by_user_id IS NULL
        OR owned_by_user_id = (
            SELECT
                auth.uid ()
        )
    )
    AND NOT public.is_current_user_banned ()
)
WITH
    CHECK (
        (
            (
                owned_by_user_id = (
                    SELECT
                        auth.uid ()
                )
                AND NOT public.is_current_user_banned ()
            )
            OR (
                public.is_application_admin ()
                AND owned_by_user_id IS NULL
            )
        )
    );

-- ─── 10.8 documents (INSERT / SELECT / UPDATE / DELETE) ────────────────────────────
ALTER POLICY "Allow authenticated users to insert documents" ON public.documents
WITH
    CHECK (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    );

ALTER POLICY "Allow authenticated users to read documents" ON public.documents USING (
    (
        owned_by_user_id IS NULL
        OR owned_by_user_id = (
            SELECT
                auth.uid ()
        )
    )
    AND NOT public.is_current_user_banned ()
);

ALTER POLICY "Allow authenticated users to update documents" ON public.documents USING (
    owned_by_user_id = (
        SELECT
            auth.uid ()
    )
    AND NOT public.is_current_user_banned ()
);

ALTER POLICY "Allow owners to delete documents and admins to delete base knowledge documents" ON public.documents USING (
    (
        (
            owned_by_user_id = (
                SELECT
                    auth.uid ()
            )
            AND NOT public.is_current_user_banned ()
        )
        OR (
            public.is_application_admin ()
            AND owned_by_user_id IS NULL
        )
    )
    AND source_type <> 'default_document'
);

-- ─── 10.9 profiles (SELECT / INSERT / UPDATE) ───────────────────────────────────────────────
ALTER POLICY "Allow authenticated users to access own profile" ON public.profiles USING (
    (
        SELECT
            auth.uid ()
    ) = id
    AND NOT public.is_current_user_banned ()
);

ALTER POLICY "Users can insert their own profile." ON public.profiles
WITH
    CHECK (
        (
            SELECT
                auth.uid ()
        ) = id
        AND NOT public.is_current_user_banned ()
    );

ALTER POLICY "Users can update own profile." ON public.profiles USING (
    (
        SELECT
            auth.uid ()
    ) = id
    AND NOT public.is_current_user_banned ()
);

-- ─── 10.10 user_hidden_default_documents (INSERT / SELECT) ──────────────────────────
ALTER POLICY "Users can insert their own hidden default docs" ON public.user_hidden_default_documents
WITH
    CHECK (
        user_id = (
            SELECT
                auth.uid ()
        )
        AND NOT public.is_current_user_banned ()
    );

ALTER POLICY "Users can view their own hidden default docs" ON public.user_hidden_default_documents USING (
    user_id = (
        SELECT
            auth.uid ()
    )
    AND NOT public.is_current_user_banned ()
);

-- ─── 10.11 storage.objects (documents bucket: INSERT / SELECT / UPDATE / DELETE) ────
ALTER POLICY "Authenticated users can upload a new document." ON storage.objects
WITH
    CHECK (
        bucket_id = 'documents'
        AND (
            SELECT
                auth.uid ()
        ) IS NOT NULL
        AND (storage.foldername (name)) [1] = (
            (
                SELECT
                    auth.uid ()
            )
        )::TEXT
        AND NOT public.is_current_user_banned ()
    );

ALTER POLICY "Users can only select their own documents." ON storage.objects USING (
    bucket_id = 'documents'
    AND owner_id = (
        (
            SELECT
                auth.uid ()
        )
    )::TEXT
    AND (storage.foldername (name)) [1] = (
        (
            SELECT
                auth.uid ()
        )
    )::TEXT
    AND NOT public.is_current_user_banned ()
);

ALTER POLICY "Users can update their own document." ON storage.objects USING (
    bucket_id = 'documents'
    AND owner_id = (
        (
            SELECT
                auth.uid ()
        )
    )::TEXT
    AND (storage.foldername (name)) [1] = (
        (
            SELECT
                auth.uid ()
        )
    )::TEXT
    AND NOT public.is_current_user_banned ()
)
WITH
    CHECK (
        bucket_id = 'documents'
        AND owner_id = (
            (
                SELECT
                    auth.uid ()
            )
        )::TEXT
        AND (storage.foldername (name)) [1] = (
            (
                SELECT
                    auth.uid ()
            )
        )::TEXT
        AND NOT public.is_current_user_banned ()
    );

ALTER POLICY "Users can delete objects where their user ID is in the path" ON storage.objects USING (
    bucket_id = 'documents'
    AND owner_id = (
        (
            SELECT
                auth.uid ()
        )
    )::TEXT
    AND (storage.foldername (name)) [1] = (
        (
            SELECT
                auth.uid ()
        )
    )::TEXT
    AND NOT public.is_current_user_banned ()
);

-- ─── 11. Drop is_current_user_active — no longer needed ───────────────────────
DROP FUNCTION IF EXISTS public.is_current_user_active ();

-- ─── 12. Drop log_account_activation - no longer needed ────────────────────────
DROP FUNCTION IF EXISTS public.log_account_activation ();

-- ─── 13. Drop get_account_activation_timestamp — no longer needed  ─────────────
DROP FUNCTION IF EXISTS public.get_account_activation_timestamp ();

-- ─── 14. Rewrite delete_user — check if the user is banned  ─────────────
CREATE OR REPLACE FUNCTION public.delete_user () RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = ''
SET
    statement_timeout TO '60000' AS $$
BEGIN
    IF public.is_current_user_banned() THEN
        RAISE EXCEPTION 'Permission denied: banned users may not delete their account';
END IF;

DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
