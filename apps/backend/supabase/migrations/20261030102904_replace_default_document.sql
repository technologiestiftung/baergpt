ALTER TABLE "public"."user_hidden_default_documents"
DROP CONSTRAINT "user_hidden_default_documents_document_id_fkey";

ALTER TABLE "public"."user_hidden_default_documents"
ADD CONSTRAINT "user_hidden_default_documents_document_id_fkey" FOREIGN KEY (document_id) REFERENCES public.documents (id) ON DELETE CASCADE NOT valid;

ALTER TABLE "public"."user_hidden_default_documents" validate CONSTRAINT "user_hidden_default_documents_document_id_fkey";

SET
    check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.replace_default_document (p_new_document_id INTEGER, p_old_document_ids INTEGER[]) RETURNS void LANGUAGE plpgsql
SET
    search_path TO '' AS $function$
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

    DELETE FROM public.documents
    WHERE id = ANY (p_old_document_ids) AND source_type = 'default_document';

    UPDATE public.documents
    SET processing_finished_at = pg_catalog.now()
    WHERE id = p_new_document_id;
END;
$function$;

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
