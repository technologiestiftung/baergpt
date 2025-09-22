CREATE OR REPLACE FUNCTION public.match_document_chunks (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER
) returns TABLE (
	id INTEGER,
	processed_document_id INTEGER,
	content TEXT,
	similarity DOUBLE PRECISION
) language plpgsql AS $function$
	#variable_conflict use_variable
BEGIN
	EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
	RETURN query
	SELECT
		processed_document_chunks.id,
		processed_document_chunks.processed_document_id,
		processed_document_chunks.content,
		(processed_document_chunks.embedding <#> embedding) * -1 as similarity
		FROM
			processed_document_chunks
		WHERE (processed_document_chunks.embedding <#> embedding) * -1 > match_threshold
			ORDER BY
				processed_document_chunks.embedding <#> embedding
			LIMIT match_count;
END;
$function$
