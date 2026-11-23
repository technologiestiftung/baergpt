CREATE OR REPLACE FUNCTION "public"."handle_new_user" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
-- Users signing up on the login page get their profile when they complete the registration
IF (new.raw_user_meta_data->>'pending_registration') IS DISTINCT FROM 'true' THEN
    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (
               new.id,
               new.raw_user_meta_data->>'first_name',
               new.raw_user_meta_data->>'last_name'
           );
END IF;
RETURN new;
END;
$$;

ALTER FUNCTION "public"."handle_new_user" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."handle_new_user" () TO "anon";

GRANT ALL ON FUNCTION "public"."handle_new_user" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_new_user" () TO "service_role";
