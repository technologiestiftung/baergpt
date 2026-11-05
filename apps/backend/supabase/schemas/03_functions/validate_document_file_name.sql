CREATE OR REPLACE FUNCTION "public"."validate_document_file_name" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    -- Only renames are validated; uploads keep the original file name, which may be longer
    IF NEW.file_name IS NULL OR btrim(NEW.file_name, E' \t\r\n') = '' THEN
        RAISE EXCEPTION 'Document name must not be empty';
    END IF;
    IF char_length(NEW.file_name) > 100 THEN
        RAISE EXCEPTION 'Document name must not be longer than 100 characters';
    END IF;
    -- Matches getFileExtension in the frontend: a leading dot does not start an extension
    IF substring(NEW.file_name FROM '^.+(\.[^.]*)$') IS DISTINCT FROM substring(OLD.file_name FROM '^.+(\.[^.]*)$') THEN
        RAISE EXCEPTION 'Document file extension must not change';
    END IF;
    -- Serializes renames per owner so concurrent ones see each other's committed name in the check below
    PERFORM pg_advisory_xact_lock(hashtext(NEW.owned_by_user_id::text));
    IF EXISTS (
        SELECT 1 FROM public.documents
        WHERE owned_by_user_id = NEW.owned_by_user_id
          AND file_name = NEW.file_name
          AND id <> NEW.id
    ) THEN
        RAISE EXCEPTION 'A document with this name already exists' USING ERRCODE = 'unique_violation';
    END IF;
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."validate_document_file_name" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "anon";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "service_role";
