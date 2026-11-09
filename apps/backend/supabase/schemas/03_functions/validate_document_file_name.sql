CREATE OR REPLACE FUNCTION "public"."validate_document_file_name" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    IF NEW.file_name IS NULL OR btrim(NEW.file_name, E' \t\r\n') = '' THEN
        RAISE EXCEPTION 'Document name must not be empty';
    END IF;
    IF char_length(NEW.file_name) > 100 THEN
        RAISE EXCEPTION 'Document name must not be longer than 100 characters';
    END IF;
    -- Keep in sync with getFileExtension in the frontend
    IF substring(NEW.file_name FROM '^.+(\.[^.]*)$') IS DISTINCT FROM substring(OLD.file_name FROM '^.+(\.[^.]*)$') THEN
        RAISE EXCEPTION 'Document file extension must not change';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(NEW.owned_by_user_id::text));
    IF public.is_document_file_name_taken(NEW.owned_by_user_id, NEW.file_name, NEW.id) THEN
        RAISE EXCEPTION 'A document with this name already exists' USING ERRCODE = 'unique_violation';
    END IF;
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."validate_document_file_name" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "anon";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "service_role";
