CREATE OR REPLACE FUNCTION "public"."prevent_maintenance_mode_delete" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    RAISE EXCEPTION 'Deleting from maintenance_mode table is not allowed';
END;
$$;

ALTER FUNCTION "public"."prevent_maintenance_mode_delete" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_delete" () TO "anon";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_delete" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."prevent_maintenance_mode_delete" () TO "service_role";
