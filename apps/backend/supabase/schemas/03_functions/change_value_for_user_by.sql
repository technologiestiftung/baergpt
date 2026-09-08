CREATE OR REPLACE FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") RETURNS "void" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $_$
BEGIN
EXECUTE format('UPDATE public.profiles SET %I = %I + $1 WHERE id = $2', column_name, column_name)
    USING amount, user_id_to_update;
END;
$_$;

ALTER FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."change_value_for_user_by" ("amount" INTEGER, "column_name" "text", "user_id_to_update" "uuid") TO "service_role";
