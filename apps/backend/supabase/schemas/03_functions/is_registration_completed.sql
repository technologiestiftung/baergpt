CREATE OR REPLACE FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") RETURNS BOOLEAN LANGUAGE "sql" IMMUTABLE
SET
    "search_path" TO '' AS $$
SELECT COALESCE(pg_catalog.btrim(user_meta_data->>'first_name'), '') <> ''
   AND COALESCE(pg_catalog.btrim(user_meta_data->>'last_name'), '') <> '';
$$;

ALTER FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") IS 'A registration is completed once first and last name are set in the user metadata. The frontend uses the same rule (hasCompletedRegistration).';

GRANT ALL ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_registration_completed" ("user_meta_data" "jsonb") TO "service_role";
