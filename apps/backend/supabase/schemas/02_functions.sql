CREATE OR REPLACE FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
	END IF;

	UPDATE public.allowed_email_domains
	SET is_active = true,
		last_status_change_at = now(),
		last_status_change_by = auth.uid()
	WHERE lower(domain) = lower(p_domain);

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Allowed domain % not found', p_domain;
	END IF;
END;
$$;

ALTER FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") IS 'Reactivates a domain (re-enables new signups only; does not reactivate users).';

CREATE OR REPLACE FUNCTION "public"."add_allowed_domain" ("p_domain" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
	END IF;

	INSERT INTO public.allowed_email_domains (domain, created_by)
	VALUES (lower(trim(p_domain)), auth.uid());
END;
$$;

ALTER FUNCTION "public"."add_allowed_domain" ("p_domain" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") IS 'Adds a domain (active by default, no status-change stamp). Format enforced by the CHECK constraint.';

CREATE OR REPLACE FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

INSERT INTO public.allowed_individual_emails (email, created_by)
VALUES (lower(trim(p_email)), auth.uid());
END;
$$;

ALTER FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") IS 'Adds an individual email to the allowlist (active by default). Format enforced by CHECK constraint.';

CREATE OR REPLACE FUNCTION "public"."add_user_to_access_group" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    -- insert default access group in case it was deleted somehow beforehand
    INSERT INTO
        public.access_groups (name)
    VALUES
        ('Alle')
    ON CONFLICT (name) DO NOTHING;
    -- add new user to default access group
    INSERT INTO public.access_group_members (user_id, access_group_id)
    SELECT NEW.id, ag.id
    FROM public.access_groups ag
    WHERE ag.name = 'Alle'
    LIMIT 1
    ON CONFLICT (user_id, access_group_id) DO NOTHING;
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."add_user_to_access_group" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") RETURNS "void" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $_$
BEGIN
  EXECUTE format('UPDATE public.profiles SET %I = %I + $1 WHERE id = $2', column_name, column_name)
  USING amount, user_id_to_update;
END;
$_$;

ALTER FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."check_email_allowed" ("p_email" "text") RETURNS BOOLEAN LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
DECLARE
email_domain TEXT;
    is_valid     BOOLEAN := FALSE;
BEGIN
    IF p_email NOT LIKE '%@%' THEN
        RETURN FALSE;
END IF;

    email_domain := lower(split_part(p_email, '@', 2));

    IF email_domain IS NULL OR email_domain = '' THEN
        RETURN FALSE;
END IF;

SELECT EXISTS (
    SELECT 1
    FROM public.allowed_email_domains
    WHERE lower(domain) = email_domain
      AND is_active = TRUE
) INTO is_valid;

IF NOT is_valid THEN
SELECT EXISTS (
    SELECT 1
    FROM public.allowed_individual_emails
    WHERE lower(email) = lower(p_email)
) INTO is_valid;
END IF;

RETURN is_valid;
END;
$$;

ALTER FUNCTION "public"."check_email_allowed" ("p_email" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."check_email_allowed" ("p_email" "text") IS 'Returns TRUE if the email passes the domain or individual-email allowlist check. Used by validate_email_domain trigger and callable directly for client-side validation.';

CREATE OR REPLACE FUNCTION "public"."check_email_registration_status" ("p_email" "text") RETURNS TABLE ("user_exists" BOOLEAN, "is_confirmed" BOOLEAN) LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
DECLARE
  v_confirmed_at timestamptz;
  v_found boolean;
BEGIN
  SELECT u.email_confirmed_at INTO v_confirmed_at
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  v_found := FOUND;

  RETURN QUERY SELECT v_found, (v_found AND v_confirmed_at IS NOT NULL);
END;
$$;

ALTER FUNCTION "public"."check_email_registration_status" ("p_email" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") RETURNS INTEGER LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO ''
SET
    "statement_timeout" TO '60000' AS $$
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

ALTER FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") IS 'Deactivates a domain and bans affected users via auth.users.banned_until.';

CREATE OR REPLACE FUNCTION "public"."delete_user" () RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO ''
SET
    "statement_timeout" TO '60000' AS $$
BEGIN
    IF public.is_current_user_banned() THEN
        RAISE EXCEPTION 'Permission denied: banned users may not delete their account';
END IF;

DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

ALTER FUNCTION "public"."delete_user" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."find_unprocessed_documents" () RETURNS TABLE (
    "id" INTEGER,
    "owned_by_user_id" "uuid",
    "source_url" "text",
    "source_type" "text",
    "file_name" "text",
    "file_checksum" "text",
    "file_size" INTEGER,
    "num_pages" INTEGER,
    "folder_id" INTEGER,
    "processing_finished_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE
) LANGUAGE "sql" STABLE
SET
    "search_path" TO '' AS $$
  SELECT id, owned_by_user_id, source_url, source_type, file_name, file_checksum, file_size, num_pages, folder_id, processing_finished_at, created_at
    FROM public.documents
   WHERE processing_finished_at IS NULL;
$$;

ALTER FUNCTION "public"."find_unprocessed_documents" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_allowed_email_domains" () RETURNS TABLE ("id" INTEGER, "domain" "text") LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
	RETURN QUERY
	SELECT aed.id, aed.domain
	FROM public.allowed_email_domains aed
	WHERE aed.is_active = TRUE
	ORDER BY aed.domain;
END;
$$;

ALTER FUNCTION "public"."get_allowed_email_domains" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_allowed_email_domains" () IS 'Returns active allowed email domains for user registration.';

CREATE OR REPLACE FUNCTION "public"."get_allowed_email_domains_admin" () RETURNS TABLE (
    "id" INTEGER,
    "domain" "text",
    "is_active" BOOLEAN,
    "created_at" TIMESTAMP WITH TIME ZONE,
    "created_by" "text",
    "last_status_change_at" TIMESTAMP WITH TIME ZONE,
    "last_status_change_by" "text",
    "user_count" BIGINT
) LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.application_admins aa WHERE aa.user_id = auth.uid()) THEN
		RAISE EXCEPTION 'Permission denied: only admins may call this function';
	END IF;

	RETURN QUERY
	SELECT
		aed.id,
		aed.domain,
		aed.is_active,
		aed.created_at,
		creator.email::text,
		aed.last_status_change_at,
		changer.email::text,
		COALESCE(uc.user_count, 0)::bigint
	FROM public.allowed_email_domains aed
	LEFT JOIN auth.users creator ON creator.id = aed.created_by
	LEFT JOIN auth.users changer ON changer.id = aed.last_status_change_by
	LEFT JOIN (
		SELECT lower(split_part(u.email, '@', 2)) AS domain, count(*) AS user_count
		FROM auth.users u
		GROUP BY 1
	) uc ON uc.domain = lower(aed.domain)
	ORDER BY aed.domain;
END;
$$;

ALTER FUNCTION "public"."get_allowed_email_domains_admin" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_allowed_email_domains_admin" () IS 'Admin listing of allowed domains with creator/last-changer emails and matching-user counts.';

CREATE OR REPLACE FUNCTION "public"."get_allowed_individual_emails" () RETURNS TABLE (
    "id" INTEGER,
    "email" "text",
    "created_at" TIMESTAMP WITH TIME ZONE,
    "created_by" "text",
    "has_account" BOOLEAN
) LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

RETURN QUERY
SELECT
    aie.id,
    aie.email,
    aie.created_at,
    creator.email::text,
    EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(aie.email))
FROM public.allowed_individual_emails aie
         LEFT JOIN auth.users creator ON creator.id = aie.created_by
ORDER BY aie.email;
END;
$$;

ALTER FUNCTION "public"."get_allowed_individual_emails" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_allowed_individual_emails" () IS 'Admin listing of allowed individual emails with audit info and account-existence flag.';

CREATE OR REPLACE FUNCTION "public"."get_base_knowledge_documents" ("input_user_id" "uuid") RETURNS TABLE (
    "id" INTEGER,
    "folder_id" INTEGER,
    "created_at" TIMESTAMP WITH TIME ZONE,
    "file_name" "text",
    "short_summary" "text",
    "tags" "text" []
) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
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

ALTER FUNCTION "public"."get_base_knowledge_documents" ("input_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) RETURNS TABLE (
    "chunk_id" INTEGER,
    "file_name" "text",
    "source_url" "text",
    "page" INTEGER,
    "created_at" TIMESTAMP WITH TIME ZONE,
    "source_type" "text",
    "snippet" "text"
) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
	RETURN QUERY
		SELECT
			document_chunk.id AS chunk_id,
			document.file_name,
			document.source_url,
			document_chunk.page,
			document.created_at,
			document.source_type,
			document_chunk.content AS snippet
		FROM public.document_chunks document_chunk
					 JOIN public.documents document ON document.id = document_chunk.document_id
		WHERE document_chunk.id = ANY(chunk_ids);
END;
$$;

ALTER FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) RETURNS TABLE ("id" INTEGER, "file_name" "text", "created_at" TIMESTAMP WITH TIME ZONE, "short_summary" "text") LANGUAGE "plpgsql" STABLE
SET
    "search_path" TO '' AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.file_name,
        d.created_at,
        ds.short_summary
    FROM public.documents d
             LEFT JOIN public.document_summaries ds ON ds.document_id = d.id
    WHERE
        d.id = ANY(input_document_ids)
       OR d.folder_id = ANY(input_folder_ids);
END;
$$;

ALTER FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER) RETURNS TABLE ("source_url" "text", "bucket_id" "text", "storage_name" "text", "storage_version" "text") LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $_$
BEGIN
RETURN QUERY
SELECT d.source_url, o.bucket_id, o.name as storage_name, o.version as storage_version
FROM public.documents d
JOIN storage.objects o ON d.source_url = o.name
    OR (d.source_url ~* '\.docx?$' AND o.name = regexp_replace(d.source_url, '\.docx?$', '.pdf', 'i'))
ORDER BY d.id
LIMIT p_limit
OFFSET p_offset;
END;
$_$;

ALTER FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_maintenance_mode_status" () RETURNS BOOLEAN LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
    SELECT COALESCE(is_enabled, FALSE)
    FROM public.maintenance_mode 
    WHERE onerow_id = true;
$$;

ALTER FUNCTION "public"."get_maintenance_mode_status" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_maintenance_mode_status" () IS 'Returns the current maintenance mode status. Can be called by anyone including unauthenticated users.';

CREATE OR REPLACE FUNCTION "public"."get_product_dashboard_stats" () RETURNS "jsonb" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
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

ALTER FUNCTION "public"."get_product_dashboard_stats" () OWNER TO "postgres";

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

CREATE OR REPLACE FUNCTION "public"."handle_new_user" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
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

ALTER FUNCTION "public"."handle_new_user" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."hybrid_chunk_search" (
    "query_text" "text",
    "query_embedding" "extensions"."vector",
    "match_count" INTEGER,
    "allowed_document_ids" INTEGER[] DEFAULT NULL::INTEGER[],
    "allowed_folder_ids" INTEGER[] DEFAULT NULL::INTEGER[],
    "full_text_weight" DOUBLE PRECISION DEFAULT 1,
    "semantic_weight" DOUBLE PRECISION DEFAULT 1,
    "rrf_k" INTEGER DEFAULT 50
) RETURNS TABLE (
    "chunk_id" INTEGER,
    "document_id" INTEGER,
    "chunk_content" "text",
    "page" INTEGER,
    "source_url" "text",
    "file_name" "text",
    "created_at" TIMESTAMP WITH TIME ZONE,
    "source_type" "text",
    "fts_score" REAL,
    "sem_score" REAL,
    "hybrid_score" REAL
) LANGUAGE "sql"
SET
    "search_path" TO 'extensions' AS $$
WITH full_text AS (
  SELECT
    id AS chunk_id,
    document_id,
    pg_catalog.ts_rank_cd(full_text_search,
                 pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery, 32) AS fts_score,
    pg_catalog.row_number() over(order BY pg_catalog.ts_rank_cd(full_text_search, pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery) desc) AS rank_ix
  FROM
    public.document_chunks
  WHERE
    full_text_search @@ pg_catalog.replace(pg_catalog.plainto_tsquery('german', query_text)::text, ' & ', ' | ')::tsquery
    AND (
      (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
      OR (allowed_folder_ids IS NOT NULL AND folder_id = any(allowed_folder_ids))
    )
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
),
semantic AS (
  SELECT
    id AS chunk_id,
    document_id,
    1 - (chunk_mistral_embedding <=> query_embedding) AS sem_score, -- cosine similarity
    pg_catalog.row_number() over (ORDER BY chunk_mistral_embedding <=> query_embedding) AS rank_ix -- using cosine distance
  FROM
    public.document_chunks
  WHERE
    chunk_mistral_embedding IS NOT NULL
    AND (
      (allowed_document_ids IS NOT NULL AND document_id = any(allowed_document_ids))
      OR (allowed_folder_ids IS NOT NULL AND folder_id = any(allowed_folder_ids))
    )
  ORDER BY rank_ix
  LIMIT least(match_count, 30) * 2
)
SELECT
  chunks.id AS chunk_id,
  chunks.document_id,
  chunks.content AS chunk_content,
  chunks.page,
  docs.source_url,
  docs.file_name,
  docs.created_at,
  docs.source_type,
  full_text.fts_score,
  semantic.sem_score,
  COALESCE(1.0/(rrf_k + full_text.rank_ix), 0) * full_text_weight + 
  COALESCE(1.0/(rrf_k + semantic.rank_ix), 0) * semantic_weight AS hybrid_score
FROM
  full_text
  FULL OUTER JOIN semantic
    ON full_text.chunk_id = semantic.chunk_id AND full_text.document_id = semantic.document_id
  JOIN public.document_chunks AS chunks
    ON COALESCE(full_text.chunk_id, semantic.chunk_id) = chunks.id
  JOIN public.documents AS docs ON chunks.document_id = docs.id
  ORDER BY hybrid_score DESC
LIMIT
  least(match_count, 30)
$$;

ALTER FUNCTION "public"."hybrid_chunk_search" (
    "query_text" "text",
    "query_embedding" "extensions"."vector",
    "match_count" INTEGER,
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[],
    "full_text_weight" DOUBLE PRECISION,
    "semantic_weight" DOUBLE PRECISION,
    "rrf_k" INTEGER
) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_application_admin" () RETURNS BOOLEAN LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
SELECT
    EXISTS (SELECT 1 FROM public.application_admins WHERE user_id = auth.uid())
    AND NOT (SELECT public.is_current_user_banned());
$$;

ALTER FUNCTION "public"."is_application_admin" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_current_user_banned" () RETURNS BOOLEAN LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.banned_until IS NOT NULL
      AND u.banned_until > now()
);
$$;

ALTER FUNCTION "public"."is_current_user_banned" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."is_current_user_banned" () IS 'Returns TRUE if the current user is banned (auth.users.banned_until in the future).';

CREATE OR REPLACE FUNCTION "public"."maintain_chat_messages_document_references" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    -- Only proceed if this is a DELETE operation
    IF TG_OP = 'DELETE' THEN
        -- Update only chat_messages where the chat still exists
UPDATE public.chat_messages cm
SET allowed_document_ids = array_remove(cm.allowed_document_ids, OLD.id)
WHERE
	-- The message references the deleted document
	cm.allowed_document_ids @> ARRAY[OLD.id]
	-- AND the chat still exists (to avoid foreign key errors)
	AND EXISTS (
	SELECT 1 FROM public.chats c
	WHERE c.id = cm.chat_id
	-- NOTE: There is an edge-case that is difficult to simulate,
	-- but has occurred in the past: if an account with many documents / chats
	-- is deleted, there can be a race condition where chats are deleted before
	-- documents. If the function then gets executed and tries to update
	-- `chat_messages` for chats that no longer exist, it raises a
	-- foreign key violation error.
);
RETURN OLD;
END IF;
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."maintain_chat_messages_document_references" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."maintain_chat_messages_folder_references" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    -- Only proceed if this is a DELETE operation
    IF TG_OP = 'DELETE' THEN
        -- Update only chat_messages where the chat still exists
UPDATE public.chat_messages cm
SET allowed_folder_ids = array_remove(cm.allowed_folder_ids, OLD.id)
WHERE
	-- The message references the deleted document
	cm.allowed_folder_ids @> ARRAY[OLD.id]
	-- AND the chat still exists (to avoid foreign key errors)
	AND EXISTS (
	SELECT 1 FROM public.chats c
	WHERE c.id = cm.chat_id
	-- NOTE: There is an edge-case that is difficult to simulate,
	-- but has occurred in the past: if an account with many folders / chats
	-- is deleted, there can be a race condition where chats are deleted before
	-- folders. If the function then gets executed and tries to update
	-- `chat_messages` for chats that no longer exist, it raises a
	-- foreign key violation error.
);
RETURN OLD;
END IF;
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."maintain_chat_messages_folder_references" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[] DEFAULT NULL::INTEGER[]
) RETURNS TABLE ("id" INTEGER, "document_id" INTEGER, "content" "text", "similarity" DOUBLE PRECISION) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
  EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, (dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1 AS similarity
  FROM public.document_chunks dc
  WHERE ((search_type='favorites' AND dc.document_id=ANY(allowed_document_ids)) OR (search_type='all_private' AND dc.owned_by_user_id=user_id)
    OR (search_type='private_folder' AND dc.owned_by_user_id=user_id AND dc.folder_id=ANY(allowed_folder_id))
    OR (search_type='public_only' AND dc.owned_by_user_id IS NULL))
    AND (dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1>match_threshold
  ORDER BY dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding LIMIT match_count;
END;
$$;

ALTER FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[] DEFAULT NULL::INTEGER[]
) RETURNS TABLE ("id" INTEGER, "document_id" INTEGER, "summary" "text", "similarity" DOUBLE PRECISION) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
  EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
  RETURN QUERY
  SELECT ds.id, ds.document_id, ds.summary, (ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1 AS similarity
  FROM public.document_summaries ds
  WHERE ((search_type='favorites' AND ds.document_id=ANY(allowed_document_ids)) OR (search_type='all_private' AND ds.owned_by_user_id=user_id)
    OR (search_type='private_folder' AND ds.owned_by_user_id=user_id AND ds.folder_id=ANY(allowed_folder_ids))
    OR (search_type='public_only' AND ds.owned_by_user_id IS NULL))
    AND (ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1>match_threshold
  ORDER BY ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding LIMIT match_count;
END;
$$;

ALTER FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[] DEFAULT NULL::INTEGER[]
) RETURNS TABLE (
    "document_id" INTEGER,
    "chunk_ids" INTEGER[],
    "chunk_similarities" DOUBLE PRECISION[],
    "avg_chunk_similarity" DOUBLE PRECISION,
    "summary_ids" INTEGER[],
    "summary_similarity" DOUBLE PRECISION,
    "similarity" DOUBLE PRECISION
) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
  RETURN QUERY WITH chunk_winners AS (
    SELECT cw.id AS chunk_id, NULL::integer AS summary_id, cw.document_id, cw.similarity
    FROM public.match_jina_document_chunks(query_embedding,match_threshold,chunk_limit,num_probes_chunks,user_id,search_type,allowed_document_ids,allowed_folder_ids) cw
  ), summary_winners AS (
    SELECT NULL::integer AS chunk_id, sw.id AS summary_id, sw.document_id, sw.similarity
    FROM public.match_jina_summaries(query_embedding,match_threshold,summary_limit,num_probes_summaries,user_id,search_type,allowed_document_ids,allowed_folder_ids) sw
  ), all_winners AS (
    SELECT * FROM chunk_winners UNION ALL SELECT * FROM summary_winners
  )
  SELECT winners.document_id, ARRAY_AGG(winners.chunk_id) FILTER(WHERE winners.chunk_id IS NOT NULL),
    ARRAY_AGG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL), AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),
    ARRAY_AGG(winners.summary_id) FILTER(WHERE winners.summary_id IS NOT NULL), AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),
    CASE WHEN COUNT(winners.chunk_id)=0 THEN COALESCE(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),0)
      WHEN COUNT(winners.summary_id)=0 THEN COALESCE(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),0)
      ELSE (COALESCE(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),0)+COALESCE(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),0))/2 END
    AS similarity
  FROM all_winners winners GROUP BY winners.document_id ORDER BY similarity DESC;
END;
$$;

ALTER FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."normalize_personal_system_prompt" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $_$
BEGIN
	NEW.personal_system_prompt := NULLIF(
		regexp_replace(NEW.personal_system_prompt, '^\s+|\s+$', '', 'g'),
		''
	);
	RETURN NEW;
END;
$_$;

ALTER FUNCTION "public"."normalize_personal_system_prompt" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."prevent_maintenance_mode_delete" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    RAISE EXCEPTION 'Deleting from maintenance_mode table is not allowed';
END;
$$;

ALTER FUNCTION "public"."prevent_maintenance_mode_delete" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."prevent_maintenance_mode_truncate" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    RAISE EXCEPTION 'Truncating maintenance_mode table is not allowed';
END;
$$;

ALTER FUNCTION "public"."prevent_maintenance_mode_truncate" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."regenerate_embedding_indices_for_chunks" () RETURNS "void" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $_$ 
BEGIN 
    DO $$
    DECLARE 
        index_name TEXT;
        numRows INT;
    BEGIN
        -- Delete old embedding indices first (check for both old and new naming patterns)
        FOR index_name IN
            SELECT indexname FROM pg_indexes 
            WHERE indexname LIKE '%document_chunks%embedding%' 
               OR indexname LIKE '%processed_document_chunks_embedding_idx%'
        LOOP
            EXECUTE 'DROP INDEX IF EXISTS ' || index_name;
        END LOOP;

        -- Generate new embedding indices
        SELECT GREATEST(1, ROUND(COUNT(*) / 1000)::INTEGER) INTO numRows FROM public.document_chunks;

        EXECUTE 'CREATE INDEX ON public.document_chunks USING ivfflat (chunk_jina_embedding vector_ip_ops) WITH (lists = ' || numRows || ')';
    END $$;
END;
$_$;

ALTER FUNCTION "public"."regenerate_embedding_indices_for_chunks" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."regenerate_embedding_indices_for_summaries" () RETURNS "void" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $_$
BEGIN 
    DO $$
    DECLARE 
        index_name TEXT;
        numRows INT;
    BEGIN 
        -- Delete old embedding indices first (check for both old and new naming patterns)
        FOR index_name IN
            SELECT indexname FROM pg_indexes 
            WHERE indexname LIKE '%document_summaries%embedding%' 
               OR indexname LIKE '%processed_document_summaries_embedding_idx%'
        LOOP
            EXECUTE 'DROP INDEX IF EXISTS ' || index_name;
        END LOOP;

        -- Generate new embedding indices
        SELECT GREATEST(1, ROUND(COUNT(*) / 1000)) INTO numRows FROM public.document_summaries;

        EXECUTE 'CREATE INDEX ON public.document_summaries USING ivfflat (summary_jina_embedding vector_ip_ops) WITH (lists = ' || numRows || ')';
    END $$;
END;
$_$;

ALTER FUNCTION "public"."regenerate_embedding_indices_for_summaries" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT public.is_application_admin() THEN
        RAISE EXCEPTION 'Permission denied: only admins may call this function';
END IF;

DELETE FROM public.allowed_individual_emails
WHERE lower(email) = lower(p_email);

IF NOT FOUND THEN
        RAISE EXCEPTION 'Individual email % not found', p_email;
END IF;
END;
$$;

ALTER FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") IS 'Removes an individual email from the allowlist.';

CREATE OR REPLACE FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER DEFAULT 50) RETURNS TABLE (
    "chat_id" INTEGER,
    "chat_name" "text",
    "chat_user_id" "uuid",
    "chat_created_at" TIMESTAMP WITH TIME ZONE,
    "message_id" INTEGER,
    "message_content" "text",
    "message_created_at" TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
	RETURN QUERY
		SELECT
			c.id AS chat_id,
			c.name AS chat_name,
			c.user_id AS chat_user_id,
			c.created_at AS chat_created_at,
			cm.id AS message_id,
			cm.content AS message_content,
			cm.created_at AS message_created_at
		FROM public.chat_messages cm
		JOIN public.chats c ON c.id = cm.chat_id
		WHERE cm.content ILIKE search_pattern
		ORDER BY cm.created_at DESC
		LIMIT result_limit;
END;
$$;

ALTER FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."tg_set_updated_at" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_folder_id_cascading" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    -- Update folder_id in document_chunks
    UPDATE public.document_chunks
    SET folder_id = NEW.folder_id
    WHERE document_id = NEW.id;

    -- Update folder_id in document_summaries
    UPDATE public.document_summaries
    SET folder_id = NEW.folder_id
    WHERE document_id = NEW.id;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_folder_id_cascading" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_maintenance_mode_updated_at" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_maintenance_mode_updated_at" () OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE) RETURNS "void" LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
    UPDATE auth.users SET email_confirmed_at = new_email_confirmed_at WHERE id = user_id;
 $$;

ALTER FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE) RETURNS "void" LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
    UPDATE auth.users SET last_sign_in_at = new_last_sign_in_at WHERE id = user_id;
$$;

ALTER FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."validate_email_domain" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT public.check_email_allowed(NEW.email) THEN
        RAISE EXCEPTION 'Email "%" is not in the list of allowed domains or individual emails', NEW.email
            USING HINT = 'Contact your administrator if you believe this email should be allowed.';
END IF;

RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."validate_email_domain" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."validate_email_domain" () IS 'Trigger: validates new/updated user emails via check_email_allowed().';

CREATE OR REPLACE FUNCTION "public"."verify_own_password" ("plain_password" "text") RETURNS BOOLEAN LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
DECLARE 
  stored_password auth.users.encrypted_password %TYPE;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT encrypted_password INTO stored_password
  FROM auth.users
  WHERE id = current_user_id;

  IF stored_password IS NULL THEN 
    RETURN FALSE;
  END IF;
    -- crypt(plain_password, stored_password) salts and hashes plain_password using the salt from stored_password
    -- using digest_compare to compare the two bytea values as a defense against timing attacks
  RETURN stored_password = extensions.crypt(plain_password, stored_password);
END;
$$;

ALTER FUNCTION "public"."verify_own_password" ("plain_password" "text") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."activate_allowed_domain" ("p_domain" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_allowed_domain" ("p_domain" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_allowed_individual_email" ("p_email" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."add_user_to_access_group" () TO "anon";

GRANT ALL ON FUNCTION "public"."add_user_to_access_group" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_user_to_access_group" () TO "service_role";

GRANT ALL ON FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."check_email_allowed" ("p_email" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."check_email_allowed" ("p_email" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."check_email_allowed" ("p_email" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_email_registration_status" ("p_email" "text")
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."check_email_registration_status" ("p_email" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."deactivate_allowed_domain" ("p_domain" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."delete_user" () TO "anon";

GRANT ALL ON FUNCTION "public"."delete_user" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."delete_user" () TO "service_role";

GRANT ALL ON FUNCTION "public"."find_unprocessed_documents" () TO "anon";

GRANT ALL ON FUNCTION "public"."find_unprocessed_documents" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."find_unprocessed_documents" () TO "service_role";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains" () TO "service_role";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains_admin" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains_admin" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains_admin" () TO "service_role";

GRANT ALL ON FUNCTION "public"."get_allowed_individual_emails" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_allowed_individual_emails" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_allowed_individual_emails" () TO "service_role";

GRANT ALL ON FUNCTION "public"."get_base_knowledge_documents" ("input_user_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."get_base_knowledge_documents" ("input_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_base_knowledge_documents" ("input_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) TO "anon";

GRANT ALL ON FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_citation_details" ("chunk_ids" INTEGER[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) TO "anon";

GRANT ALL ON FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER)
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."get_documents_with_storage_objects" ("p_limit" INTEGER, "p_offset" INTEGER) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_maintenance_mode_status" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_maintenance_mode_status" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_maintenance_mode_status" () TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_product_dashboard_stats" ()
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."get_product_dashboard_stats" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_product_dashboard_stats" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_users" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_users" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_users" () TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user" () TO "anon";

GRANT ALL ON FUNCTION "public"."handle_new_user" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_new_user" () TO "service_role";

GRANT ALL ON FUNCTION "public"."hybrid_chunk_search" (
    "query_text" "text",
    "query_embedding" "extensions"."vector",
    "match_count" INTEGER,
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[],
    "full_text_weight" DOUBLE PRECISION,
    "semantic_weight" DOUBLE PRECISION,
    "rrf_k" INTEGER
) TO "anon";

GRANT ALL ON FUNCTION "public"."hybrid_chunk_search" (
    "query_text" "text",
    "query_embedding" "extensions"."vector",
    "match_count" INTEGER,
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[],
    "full_text_weight" DOUBLE PRECISION,
    "semantic_weight" DOUBLE PRECISION,
    "rrf_k" INTEGER
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."hybrid_chunk_search" (
    "query_text" "text",
    "query_embedding" "extensions"."vector",
    "match_count" INTEGER,
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[],
    "full_text_weight" DOUBLE PRECISION,
    "semantic_weight" DOUBLE PRECISION,
    "rrf_k" INTEGER
) TO "service_role";

GRANT ALL ON FUNCTION "public"."is_application_admin" () TO "anon";

GRANT ALL ON FUNCTION "public"."is_application_admin" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_application_admin" () TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_current_user_banned" ()
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."is_current_user_banned" () TO "anon";

GRANT ALL ON FUNCTION "public"."is_current_user_banned" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_current_user_banned" () TO "service_role";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_document_references" () TO "anon";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_document_references" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_document_references" () TO "service_role";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_folder_references" () TO "anon";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_folder_references" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_folder_references" () TO "service_role";

GRANT ALL ON FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) TO "anon";

GRANT ALL ON FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."match_jina_document_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_id" INTEGER[]
) TO "service_role";

GRANT ALL ON FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) TO "anon";

GRANT ALL ON FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."match_jina_summaries" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "match_count" INTEGER,
    "num_probes" INTEGER,
    "user_id" "uuid",
    "search_type" "text",
    "allowed_document_ids" INTEGER[],
    "allowed_folder_ids" INTEGER[]
) TO "service_role";

GRANT ALL ON FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) TO "anon";

GRANT ALL ON FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) TO "authenticated";

GRANT ALL ON FUNCTION "public"."match_jina_summaries_and_chunks" (
    "query_embedding" "extensions"."vector",
    "match_threshold" DOUBLE PRECISION,
    "chunk_limit" INTEGER,
    "summary_limit" INTEGER,
    "num_probes_chunks" INTEGER,
    "num_probes_summaries" INTEGER,
    "user_id" "uuid",
    "allowed_document_ids" INTEGER[],
    "search_type" "text",
    "allowed_folder_ids" INTEGER[]
) TO "service_role";

GRANT ALL ON FUNCTION "public"."normalize_personal_system_prompt" () TO "anon";

GRANT ALL ON FUNCTION "public"."normalize_personal_system_prompt" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."normalize_personal_system_prompt" () TO "service_role";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_delete" () TO "anon";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_delete" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_delete" () TO "service_role";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_truncate" () TO "anon";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_truncate" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_truncate" () TO "service_role";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_chunks" () TO "anon";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_chunks" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_chunks" () TO "service_role";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_summaries" () TO "anon";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_summaries" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_summaries" () TO "service_role";

GRANT ALL ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."remove_allowed_individual_email" ("p_email" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) TO "anon";

GRANT ALL ON FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) TO "authenticated";

GRANT ALL ON FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) TO "service_role";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at" () TO "anon";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at" () TO "service_role";

GRANT ALL ON FUNCTION "public"."update_folder_id_cascading" () TO "anon";

GRANT ALL ON FUNCTION "public"."update_folder_id_cascading" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_folder_id_cascading" () TO "service_role";

GRANT ALL ON FUNCTION "public"."update_maintenance_mode_updated_at" () TO "anon";

GRANT ALL ON FUNCTION "public"."update_maintenance_mode_updated_at" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_maintenance_mode_updated_at" () TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE)
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE) TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE)
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE) TO "service_role";

GRANT ALL ON FUNCTION "public"."validate_email_domain" () TO "anon";

GRANT ALL ON FUNCTION "public"."validate_email_domain" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_email_domain" () TO "service_role";

GRANT ALL ON FUNCTION "public"."verify_own_password" ("plain_password" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."verify_own_password" ("plain_password" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."verify_own_password" ("plain_password" "text") TO "service_role";
