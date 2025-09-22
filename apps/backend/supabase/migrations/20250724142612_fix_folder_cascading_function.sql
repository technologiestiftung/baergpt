-- Fix update_folder_id_cascading function for new schema
-- The old function referenced dropped tables, this updates it for current schema
-- Create new simplified cascading function
CREATE OR REPLACE FUNCTION public.update_folder_id_cascading () returns trigger language plpgsql
SET
	search_path = '' AS $$
BEGIN
    -- Update folder_id in document_chunks
    UPDATE public.document_chunks
    SET folder_id = NEW.folder_id
    WHERE document_id = NEW.id;

    -- Update folder_id in document_summaries
    UPDATE public.document_summaries
    SET folder_id = NEW.folder_id
    WHERE document_id = NEW.id;

    RETURN NEW;
END;
$$;

-- Create new trigger on documents table for folder_id changes
DROP TRIGGER if EXISTS trg_update_folder_id_cascading ON documents;

CREATE TRIGGER trg_update_folder_id_cascading
AFTER
UPDATE of folder_id ON public.documents FOR each ROW WHEN (old.folder_id IS DISTINCT FROM new.folder_id)
EXECUTE function public.update_folder_id_cascading ();
