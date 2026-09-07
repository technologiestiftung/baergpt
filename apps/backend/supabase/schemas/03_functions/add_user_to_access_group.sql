CREATE OR REPLACE FUNCTION "public"."add_user_to_access_group" () RETURNS "trigger" LANGUAGE "plpgsql" SECURITY DEFINER
SET
    "search_path" TO '' AS $$
BEGIN
    -- insert default access group in case it was deleted somehow beforehand
INSERT INTO
    public.access_groups (name)
VALUES
    ('Alle')
    ON CONFLICT (name) DO NOTHING;
-- add new user to default access group
INSERT INTO public.access_group_members (user_id, access_group_id)
SELECT NEW.id, ag.id
FROM public.access_groups ag
WHERE ag.name = 'Alle'
    LIMIT 1
ON CONFLICT (user_id, access_group_id) DO NOTHING;
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."add_user_to_access_group" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."add_user_to_access_group" () TO "anon";

GRANT ALL ON FUNCTION "public"."add_user_to_access_group" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_user_to_access_group" () TO "service_role";
