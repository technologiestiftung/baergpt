CREATE OR REPLACE FUNCTION "public"."prevent_maintenance_mode_truncate" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    RAISE EXCEPTION 'Truncating maintenance_mode table is not allowed';
END;
$$;

ALTER FUNCTION "public"."prevent_maintenance_mode_truncate" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_truncate" () TO "anon";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_truncate" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_truncate" () TO "service_role";
