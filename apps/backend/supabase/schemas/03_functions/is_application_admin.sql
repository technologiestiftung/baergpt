CREATE OR REPLACE FUNCTION "public"."is_application_admin" () RETURNS BOOLEAN LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
SELECT
    EXISTS (SELECT 1 FROM public.application_admins WHERE user_id = auth.uid())
        AND NOT (SELECT public.is_current_user_banned_or_deleted());
$$;

ALTER FUNCTION "public"."is_application_admin" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."is_application_admin" () TO "anon";

GRANT ALL ON FUNCTION "public"."is_application_admin" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_application_admin" () TO "service_role";
