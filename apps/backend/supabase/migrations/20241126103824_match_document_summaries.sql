CREATE OR REPLACE FUNCTION public.match_summaries (embedding vector, match_threshold DOUBLE PRECISION, match_count INTEGER, num_probes INTEGER) returns TABLE (id INTEGER, processed_document_id INTEGER, summary TEXT, similarity DOUBLE PRECISION) language plpgsql AS $function$
	#variable_conflict use_variable
BEGIN
	EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
	RETURN query
	SELECT
		processed_document_summaries.id,
		processed_document_summaries.processed_document_id,
		processed_document_summaries.summary,
		(processed_document_summaries.summary_embedding <#> embedding) * -1 as similarity
		FROM
			processed_document_summaries
		WHERE (processed_document_summaries.summary_embedding <#> embedding) * -1 > match_threshold
			ORDER BY
				processed_document_summaries.summary_embedding <#> embedding
			LIMIT match_count;
END;
$function$
