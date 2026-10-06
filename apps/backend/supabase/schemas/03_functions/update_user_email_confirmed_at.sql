CREATE OR REPLACE FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE) RETURNS "void" LANGUAGE "sql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
UPDATE auth.users SET email_confirmed_at = new_email_confirmed_at WHERE id = user_id;
$$;

ALTER FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE)
FROM
    PUBLIC;

GRANT ALL ON FUNCTION "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE) TO "service_role";
