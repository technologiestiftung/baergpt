DROP TRIGGER IF EXISTS trigger_document_deletion_cleanup ON public.documents;

DROP FUNCTION IF EXISTS public.handle_document_deletion ();

DROP FUNCTION IF EXISTS public.delete_document_and_update_count (BIGINT);

-- Delete all currently orphaned storage objects
DELETE FROM storage.objects
WHERE
    bucket_id = 'documents'
    AND name NOT IN (
        SELECT
            source_url
        FROM
            public.documents
    );

DELETE FROM storage.objects
WHERE
    bucket_id = 'public_documents'
    AND name NOT IN (
        SELECT
            source_url
        FROM
            public.documents
        WHERE
            source_type = 'public_document'
    );
