ALTER TABLE processed_documents
ADD COLUMN folder_id INTEGER;

ALTER TABLE processed_document_chunks
ADD COLUMN folder_id INTEGER;

ALTER TABLE processed_document_summaries
ADD COLUMN folder_id INTEGER;

-- fix missing RLS
CREATE POLICY "Allow authenticated users to update own processed_document_chunks" ON "public"."processed_document_chunks"
FOR UPDATE
	TO authenticated USING (owned_by_user_id = auth.uid ());

CREATE POLICY "Allow authenticated users to insert own processed_document_chunks" ON "public"."processed_document_chunks" FOR insert TO authenticated
WITH
	CHECK (owned_by_user_id = auth.uid ());

-- Combined function to handle cascading updates
CREATE OR REPLACE FUNCTION update_folder_id_cascading () returns trigger AS $$
BEGIN
    -- Update folder_id in processed_documents
    UPDATE processed_documents
    SET folder_id = NEW.folder_id
    WHERE registered_document_id = NEW.id;

    -- Update folder_id in processed_document_chunks
    UPDATE processed_document_chunks
    SET folder_id = NEW.folder_id
    WHERE processed_document_id IN (
        SELECT id FROM processed_documents WHERE registered_document_id = NEW.id
    );

    -- Update folder_id in processed_document_summaries
    UPDATE processed_document_summaries
    SET folder_id = NEW.folder_id
    WHERE processed_document_id IN (
        SELECT id FROM processed_documents WHERE registered_document_id = NEW.id
    );

    RETURN NEW;
END;
$$ language plpgsql;

-- Create a single trigger on the registered_documents table
CREATE TRIGGER trg_update_folder_id_cascading
AFTER
UPDATE of folder_id ON registered_documents FOR each ROW WHEN (old.folder_id IS DISTINCT FROM new.folder_id)
EXECUTE function update_folder_id_cascading ();

-- existing data migration
UPDATE processed_documents
SET
	folder_id = (
		SELECT
			folder_id
		FROM
			registered_documents
		WHERE
			registered_documents.id = processed_documents.registered_document_id
	);

UPDATE processed_document_chunks
SET
	folder_id = (
		SELECT
			folder_id
		FROM
			processed_documents
		WHERE
			processed_documents.id = processed_document_chunks.processed_document_id
	);

UPDATE processed_document_summaries
SET
	folder_id = (
		SELECT
			folder_id
		FROM
			processed_documents
		WHERE
			processed_documents.id = processed_document_summaries.processed_document_id
	);

DROP FUNCTION if EXISTS public.match_document_chunks (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[]
);

CREATE OR REPLACE FUNCTION public.match_document_chunks (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[],
	allowed_folder_id INTEGER DEFAULT NULL::INTEGER
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
		WHERE 
		  (processed_document_chunks.owned_by_user_id IS NULL OR processed_document_chunks.owned_by_user_id = user_id)
		  AND (
		    use_all = TRUE
		    OR processed_document_chunks.processed_document_id = ANY (allowed_processed_document_ids)
		    OR processed_document_chunks.folder_id = allowed_folder_id
		  )
		  AND
		  (processed_document_chunks.embedding <#> embedding) * -1 > match_threshold

		ORDER BY
			processed_document_chunks.embedding <#> embedding
		LIMIT match_count;
END;
$function$;

DROP FUNCTION if EXISTS public.match_summaries (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[]
);

CREATE OR REPLACE FUNCTION public.match_summaries (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[],
	allowed_folder_id INTEGER DEFAULT NULL::INTEGER
) returns TABLE (
	id INTEGER,
	processed_document_id INTEGER,
	summary TEXT,
	similarity DOUBLE PRECISION
) language plpgsql AS $function$
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
		WHERE 
		  (processed_document_summaries.owned_by_user_id IS NULL OR processed_document_summaries.owned_by_user_id = user_id)
		  AND (
		    use_all = TRUE
		    OR processed_document_summaries.processed_document_id = ANY (allowed_processed_document_ids)
		    OR processed_document_summaries.folder_id = allowed_folder_id
		  )
		  AND
		  (processed_document_summaries.summary_embedding <#> embedding) * -1 > match_threshold
			ORDER BY
				processed_document_summaries.summary_embedding <#> embedding
			LIMIT match_count;
END;
$function$;

DROP FUNCTION if EXISTS public.match_summaries_and_chunks (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	chunk_limit INTEGER,
	summary_limit INTEGER,
	num_probes_chunks INTEGER,
	num_probes_summaries INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[]
);

CREATE OR REPLACE FUNCTION public.match_summaries_and_chunks (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	chunk_limit INTEGER,
	summary_limit INTEGER,
	num_probes_chunks INTEGER,
	num_probes_summaries INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[],
	allowed_folder_id INTEGER DEFAULT NULL
) returns TABLE (
	processed_document_id INTEGER,
	chunk_ids INTEGER[],
	chunk_similarities DOUBLE PRECISION[],
	avg_chunk_similarity DOUBLE PRECISION,
	summary_ids INTEGER[],
	summary_similarity DOUBLE PRECISION,
	similarity DOUBLE PRECISION
) language plpgsql AS $function$
	# variable_conflict use_variable
BEGIN
	RETURN query WITH chunk_winners AS(
		SELECT
			cw.id AS chunk_id,
			NULL AS summary_id,
			cw.processed_document_id,
			cw.similarity
		FROM
			match_document_chunks(embedding, match_threshold, chunk_limit, num_probes_chunks, user_id, use_all, allowed_processed_document_ids, allowed_folder_id) AS cw
),
summary_winners AS(
	SELECT
		NULL AS chunk_id,
		sw.id AS summary_id,
		sw.processed_document_id,
		sw.similarity
	FROM
		match_summaries(embedding, match_threshold, summary_limit, num_probes_summaries, user_id, use_all, allowed_processed_document_ids, allowed_folder_id) AS sw
),
all_winners AS(
	SELECT
		chunk_winners.chunk_id,
		NULL AS summary_id,
		chunk_winners.processed_document_id,
		chunk_winners.similarity
	FROM
		chunk_winners
	UNION ALL
	SELECT
		NULL AS chunk_id,
		summary_winners.summary_id,
		summary_winners.processed_document_id,
		summary_winners.similarity
	FROM
		summary_winners
)
SELECT
	winners.processed_document_id,
	ARRAY_AGG(winners.chunk_id) FILTER(WHERE winners.chunk_id IS NOT NULL) AS chunk_ids,
	ARRAY_AGG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL) AS chunk_similarities,
	AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL) AS avg_chunk_similarity,
	ARRAY_AGG(winners.summary_id) FILTER(WHERE winners.summary_id IS NOT NULL) AS summary_ids,
	AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL) AS summary_similarity,
	CASE WHEN ARRAY_LENGTH(ARRAY_AGG(winners.chunk_id) FILTER(WHERE winners.chunk_id IS NOT NULL), 1) IS NULL THEN
		coalesce(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL), 0)
	WHEN ARRAY_LENGTH(ARRAY_AGG(winners.summary_id) FILTER(WHERE winners.summary_id IS NOT NULL), 1) IS NULL THEN
		coalesce(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL), 0)
	ELSE
(coalesce(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL), 0) + coalesce(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL), 0)) / 2.0
	END similarity
FROM
	all_winners AS winners
GROUP BY
	winners.processed_document_id
ORDER BY
	similarity DESC;
END;
$function$;
