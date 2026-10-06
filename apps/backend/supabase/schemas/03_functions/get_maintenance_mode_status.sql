CREATE OR REPLACE FUNCTION "public"."get_maintenance_mode_status" () RETURNS BOOLEAN LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
SELECT COALESCE(is_enabled, FALSE)
FROM public.maintenance_mode
WHERE onerow_id = true;
$$;

ALTER FUNCTION "public"."get_maintenance_mode_status" () OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_maintenance_mode_status" () IS 'Returns the current maintenance mode status. Can be called by anyone including unauthenticated users.';

GRANT ALL ON FUNCTION "public"."get_maintenance_mode_status" () TO "anon";

GRANT ALL ON FUNCTION "public"."get_maintenance_mode_status" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_maintenance_mode_status" () TO "service_role";
