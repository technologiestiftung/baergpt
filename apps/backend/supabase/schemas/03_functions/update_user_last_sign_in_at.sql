CREATE OR REPLACE FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE) RETURNS "void" LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
UPDATE auth.users SET last_sign_in_at = new_last_sign_in_at WHERE id = user_id;
$$;

ALTER FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE)
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE) TO "service_role";
