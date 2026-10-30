CREATE OR REPLACE FUNCTION "public"."replace_default_document" ("p_new_document_id" INTEGER, "p_old_document_ids" INTEGER[]) RETURNS "void" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.documents
        WHERE id = p_new_document_id AND source_type = 'default_document'
    ) THEN
        RAISE EXCEPTION 'Default document % does not exist', p_new_document_id;
    END IF;

    INSERT INTO public.user_hidden_default_documents (user_id, document_id)
    SELECT DISTINCT h.user_id, p_new_document_id
    FROM public.user_hidden_default_documents h
    WHERE h.document_id = ANY (p_old_document_ids)
    ON CONFLICT DO NOTHING;

    -- Otherwise the delete trigger removes the reference from these messages
    UPDATE public.chat_messages cm
    SET allowed_document_ids = pg_catalog.array_append(
        ARRAY(
            SELECT d FROM pg_catalog.unnest(cm.allowed_document_ids) AS d
            WHERE d <> ALL (p_old_document_ids) AND d <> p_new_document_id
        ),
        p_new_document_id
    )
    WHERE cm.allowed_document_ids && p_old_document_ids;

    DELETE FROM public.documents
    WHERE id = ANY (p_old_document_ids) AND source_type = 'default_document';

    UPDATE public.documents
    SET processing_finished_at = pg_catalog.now()
    WHERE id = p_new_document_id;
END;
$$;

ALTER FUNCTION "public"."replace_default_document" ("p_new_document_id" INTEGER, "p_old_document_ids" INTEGER[]) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."replace_default_document" ("p_new_document_id" INTEGER, "p_old_document_ids" INTEGER[]) IS 'Swaps previous versions of a default document for a new version in one transaction: carries over hidden state and chat message references, deletes the previous versions and makes the new version visible. Used by the upload-default-documents script.';

REVOKE ALL ON FUNCTION "public"."replace_default_document" ("p_new_document_id" INTEGER, "p_old_document_ids" INTEGER[])
FROM
    PUBLIC;

REVOKE ALL ON FUNCTION "public"."replace_default_document" ("p_new_document_id" INTEGER, "p_old_document_ids" INTEGER[])
FROM
    "anon";

REVOKE ALL ON FUNCTION "public"."replace_default_document" ("p_new_document_id" INTEGER, "p_old_document_ids" INTEGER[])
FROM
    "authenticated";

GRANT
EXECUTE ON FUNCTION "public"."replace_default_document" ("p_new_document_id" INTEGER, "p_old_document_ids" INTEGER[]) TO "service_role";
