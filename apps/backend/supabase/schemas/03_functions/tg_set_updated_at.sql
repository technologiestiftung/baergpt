CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    NEW.updated_at := NOW();
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."tg_set_updated_at" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at" () TO "anon";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at" () TO "service_role";
