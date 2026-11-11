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
    IF NEW.file_name IS NULL OR btrim(NEW.file_name, E' \t\r\n\u00A0') = '' THEN
        RAISE EXCEPTION 'Document name must not be empty';
    END IF;
    IF char_length(NEW.file_name) > 100 THEN
        RAISE EXCEPTION 'Document name must not be longer than 100 characters';
    END IF;
    -- Keep in sync with getFileExtension in the frontend
    IF OLD.file_name IS NOT NULL
       AND substring(NEW.file_name FROM '^.+(\.[^.]*)$') IS DISTINCT FROM substring(OLD.file_name FROM '^.+(\.[^.]*)$') THEN
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

CREATE TEMPORARY TABLE duplicate_personal_documents AS
SELECT
    id,
    survivor_id,
    owned_by_user_id
FROM
    (
        SELECT
            id,
            owned_by_user_id,
            FIRST_VALUE(id) OVER (
                PARTITION BY
                    owned_by_user_id,
                    file_checksum
                ORDER BY
                    processing_finished_at IS NULL,
                    id
            ) AS survivor_id
        FROM
            public.documents
        WHERE
            source_type = 'personal_document'
            AND file_checksum IS NOT NULL
    ) ranked
WHERE
    id <> survivor_id;

UPDATE public.chat_messages cm
SET
    allowed_document_ids = (
        SELECT
            ARRAY_AGG(DISTINCT COALESCE(d.survivor_id, a.id))
        FROM
            UNNEST(cm.allowed_document_ids) AS a (id)
            LEFT JOIN duplicate_personal_documents d ON d.id = a.id
    )
WHERE
    cm.allowed_document_ids && (
        SELECT
            ARRAY_AGG(id)
        FROM
            duplicate_personal_documents
    );

CREATE TEMPORARY TABLE cited_duplicate_chunks AS
SELECT
    chunk.id AS chunk_id,
    duplicate.survivor_id,
    (
        SELECT
            survivor_chunk.id
        FROM
            public.document_chunks survivor_chunk
        WHERE
            survivor_chunk.document_id = duplicate.survivor_id
            AND survivor_chunk.content = chunk.content
        ORDER BY
            survivor_chunk.id
        LIMIT
            1
    ) AS survivor_chunk_id
FROM
    public.document_chunks chunk
    JOIN duplicate_personal_documents duplicate ON duplicate.id = chunk.document_id
WHERE
    EXISTS (
        SELECT
            1
        FROM
            public.chat_messages cm
        WHERE
            jsonb_typeof(cm.citations) = 'array'
            AND cm.citations @> to_jsonb(ARRAY[chunk.id])
    );

UPDATE public.chat_messages cm
SET
    citations = (
        SELECT
            jsonb_agg(
                remapped.value
                ORDER BY
                    remapped.position
            )
        FROM
            (
                SELECT
                    COALESCE(to_jsonb(cited.survivor_chunk_id), citation.value) AS value,
                    MIN(citation.position) AS position
                FROM
                    jsonb_array_elements(cm.citations)
                WITH
                    ORDINALITY AS citation (value, position)
                    LEFT JOIN cited_duplicate_chunks cited ON citation.value = to_jsonb(cited.chunk_id)
                GROUP BY
                    1
            ) remapped
    )
WHERE
    jsonb_typeof(cm.citations) = 'array'
    AND EXISTS (
        SELECT
            1
        FROM
            cited_duplicate_chunks cited
        WHERE
            cited.survivor_chunk_id IS NOT NULL
            AND cm.citations @> to_jsonb(ARRAY[cited.chunk_id])
    );

UPDATE public.document_chunks chunk
SET
    document_id = survivor.id,
    folder_id = survivor.folder_id
FROM
    cited_duplicate_chunks cited
    JOIN public.documents survivor ON survivor.id = cited.survivor_id
WHERE
    chunk.id = cited.chunk_id
    AND cited.survivor_chunk_id IS NULL;

DROP TABLE cited_duplicate_chunks;

DELETE FROM public.documents
WHERE
    id IN (
        SELECT
            id
        FROM
            duplicate_personal_documents
    );

UPDATE public.profiles p
SET
    num_documents = (
        SELECT
            COUNT(*)
        FROM
            public.documents d
        WHERE
            d.owned_by_user_id = p.id
    )
WHERE
    p.id IN (
        SELECT
            owned_by_user_id
        FROM
            duplicate_personal_documents
    );

DROP TABLE duplicate_personal_documents;

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
    suffix text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.owned_by_user_id::text));
    IF NOT public.is_document_file_name_taken(NEW.owned_by_user_id, NEW.file_name) THEN
        RETURN NEW;
    END IF;
    base_name := regexp_replace(base_name, ' \(\d+\)$', '');
    LOOP
        counter := counter + 1;
        suffix := ' (' || counter || ')';
        NEW.file_name := left(base_name, greatest(0, 100 - char_length(suffix) - char_length(extension))) || suffix || extension;
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
