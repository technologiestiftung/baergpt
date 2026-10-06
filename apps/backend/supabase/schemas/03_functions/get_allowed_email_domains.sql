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

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_allowed_email_domains" () TO "service_role";
