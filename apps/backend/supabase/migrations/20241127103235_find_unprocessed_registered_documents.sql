CREATE OR REPLACE FUNCTION public.find_unprocessed_registered_documents () returns TABLE (
	id INTEGER,
	owned_by_user_id UUID,
	source_url TEXT,
	source_type TEXT,
	registered_at TIMESTAMP WITH TIME ZONE,
	metadata JSONB
) language plpgsql AS $function$
BEGIN
RETURN query
SELECT registered_documents.* FROM registered_documents FULL OUTER JOIN processed_documents ON registered_documents.id = processed_documents.registered_document_id WHERE registered_document_id IS NULL;
END;
$function$
