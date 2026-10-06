CREATE OR REPLACE FUNCTION "public"."update_maintenance_mode_updated_at" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_maintenance_mode_updated_at" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."update_maintenance_mode_updated_at" () TO "anon";

GRANT ALL ON FUNCTION "public"."update_maintenance_mode_updated_at" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_maintenance_mode_updated_at" () TO "service_role";
