CREATE OR REPLACE FUNCTION "public"."delete_user" () RETURNS "void" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO ''
SET
    "statement_timeout" TO '60000' AS $$
BEGIN
    IF public.is_current_user_banned() THEN
        RAISE EXCEPTION 'Permission denied: banned users may not delete their account';
END IF;

DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

ALTER FUNCTION "public"."delete_user" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."delete_user" () TO "anon";

GRANT ALL ON FUNCTION "public"."delete_user" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."delete_user" () TO "service_role";
