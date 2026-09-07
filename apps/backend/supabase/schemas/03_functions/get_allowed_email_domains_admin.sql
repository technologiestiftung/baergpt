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

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains_admin" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains_admin" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains_admin" () TO "service_role";
