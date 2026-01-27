DROP TRIGGER IF EXISTS trigger_document_deletion_cleanup ON public.documents;

DROP FUNCTION IF EXISTS public.handle_document_deletion ();

DROP FUNCTION IF EXISTS public.delete_document_and_update_count (BIGINT);
