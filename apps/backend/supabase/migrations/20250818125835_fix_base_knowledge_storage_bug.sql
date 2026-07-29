-- Fix base knowledge document storage deletion bug
-- Enhance handle_document_deletion function to support both user documents and public documents
CREATE OR REPLACE FUNCTION public.handle_document_deletion () returns trigger language plpgsql security definer
SET
    search_path = '' AS $$
DECLARE
    file_path TEXT;
    pdf_file_path TEXT;
    target_bucket TEXT;
BEGIN
    file_path := OLD.source_url;
    
    IF file_path IS NOT NULL AND file_path != '' THEN
        IF OLD.owned_by_user_id IS NOT NULL THEN
            target_bucket := 'documents';
        ELSE
            target_bucket := 'public_documents';
        END IF;
        
        DELETE FROM storage.objects 
        WHERE bucket_id = target_bucket AND name = file_path;
        
        -- If the file is a DOCX, also delete the PDF preview version
        IF LOWER(file_path) LIKE '%.docx' THEN
            pdf_file_path := pg_catalog.REGEXP_REPLACE(file_path, '\.docx$', '.pdf', 'i');
            DELETE FROM storage.objects 
            WHERE bucket_id = target_bucket AND name = pdf_file_path;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$;
