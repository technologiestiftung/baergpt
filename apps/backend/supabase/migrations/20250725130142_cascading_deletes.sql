-- Migration to add cascading deletes for documents
CREATE OR REPLACE FUNCTION handle_document_deletion () returns trigger AS $$
DECLARE
    file_path TEXT;
    pdf_file_path TEXT;
BEGIN
    file_path := OLD.source_url;
    
    IF file_path IS NOT NULL AND file_path != '' THEN
        -- Delete the main file from storage
        DELETE FROM storage.objects 
        WHERE bucket_id = 'documents' AND name = file_path;
        
        -- If the file is a DOCX, also delete the PDF preview version
        IF LOWER(file_path) LIKE '%.docx' THEN
            pdf_file_path := REGEXP_REPLACE(file_path, '\.docx$', '.pdf', 'i');
            DELETE FROM storage.objects 
            WHERE bucket_id = 'documents' AND name = pdf_file_path;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ language plpgsql security definer;

CREATE TRIGGER trigger_document_deletion_cleanup
AFTER delete ON documents FOR each ROW
EXECUTE function handle_document_deletion ();

comment ON trigger trigger_document_deletion_cleanup ON documents IS 'Automatically handles file storage cleanup when a document is deleted';

comment ON function handle_document_deletion () IS 'Cleans up storage files when a document is deleted. 
Called automatically by trigger_document_deletion_cleanup.';
