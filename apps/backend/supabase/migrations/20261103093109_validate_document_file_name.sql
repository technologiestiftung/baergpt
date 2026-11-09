SET
    check_function_bodies = off;

CREATE OR REPLACE FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER DEFAULT NULL) RETURNS BOOLEAN LANGUAGE "plpgsql" STABLE
SET
    "search_path" TO '' AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.file_name = p_file_name
          AND d.id IS DISTINCT FROM p_excluded_document_id
          AND (
              d.owned_by_user_id = p_user_id
              OR (
                  d.source_type = 'default_document'
                  AND d.owned_by_user_id IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM public.user_hidden_default_documents h
                      WHERE h.user_id = p_user_id AND h.document_id = d.id
                  )
              )
          )
    );
END;
$$;

GRANT ALL ON FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER) TO "anon";

GRANT ALL ON FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER) TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER) TO "service_role";

CREATE OR REPLACE FUNCTION public.validate_document_file_name () RETURNS trigger LANGUAGE plpgsql
SET
    search_path TO '' AS $function$
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
$function$;

CREATE TRIGGER trg_validate_document_file_name
BEFORE UPDATE OF file_name ON public.documents FOR EACH ROW WHEN ((old.file_name IS DISTINCT FROM new.file_name))
EXECUTE FUNCTION public.validate_document_file_name ();

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "anon";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_document_file_name" () TO "service_role";

CREATE UNIQUE INDEX idx_documents_personal_checksum_unique ON public.documents USING btree (owned_by_user_id, file_checksum)
WHERE
    (source_type = 'personal_document'::TEXT);

CREATE OR REPLACE FUNCTION public.dedupe_document_file_name () RETURNS trigger LANGUAGE plpgsql
SET
    search_path TO '' AS $function$
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
$function$;

CREATE TRIGGER trg_dedupe_document_file_name
BEFORE INSERT ON public.documents FOR EACH ROW WHEN (
    (
        (new.owned_by_user_id IS NOT NULL)
        AND (new.file_name IS NOT NULL)
    )
)
EXECUTE FUNCTION public.dedupe_document_file_name ();

GRANT ALL ON FUNCTION "public"."dedupe_document_file_name" () TO "anon";

GRANT ALL ON FUNCTION "public"."dedupe_document_file_name" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."dedupe_document_file_name" () TO "service_role";
