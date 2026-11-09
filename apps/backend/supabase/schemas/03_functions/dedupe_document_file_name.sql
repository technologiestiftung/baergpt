CREATE OR REPLACE FUNCTION "public"."dedupe_document_file_name" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
DECLARE
    extension text := coalesce(substring(NEW.file_name FROM '^.+(\.[^.]*)$'), '');
    base_name text := left(NEW.file_name, char_length(NEW.file_name) - char_length(extension));
    counter integer := 1;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.owned_by_user_id::text));
    IF NOT public.is_document_file_name_taken(NEW.owned_by_user_id, NEW.file_name) THEN
        RETURN NEW;
    END IF;
    base_name := regexp_replace(base_name, ' \(\d+\)$', '');
    LOOP
        counter := counter + 1;
        NEW.file_name := base_name || ' (' || counter || ')' || extension;
        EXIT WHEN NOT public.is_document_file_name_taken(NEW.owned_by_user_id, NEW.file_name);
    END LOOP;
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."dedupe_document_file_name" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."dedupe_document_file_name" () TO "anon";

GRANT ALL ON FUNCTION "public"."dedupe_document_file_name" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."dedupe_document_file_name" () TO "service_role";
