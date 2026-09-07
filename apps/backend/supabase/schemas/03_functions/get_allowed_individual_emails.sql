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

GRANT ALL ON FUNCTION "public"."get_allowed_individual_emails" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_allowed_individual_emails" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_allowed_individual_emails" () TO "service_role";
