DROP FUNCTION if EXISTS public.match_document_chunks (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[],
	allowed_folder_id INTEGER
);

DROP FUNCTION if EXISTS public.match_summaries (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[],
	allowed_folder_id INTEGER
);

DROP FUNCTION if EXISTS public.match_summaries_and_chunks (
	embedding vector,
	match_threshold DOUBLE PRECISION,
	chunk_limit INTEGER,
	summary_limit INTEGER,
	num_probes_chunks INTEGER,
	num_probes_summaries INTEGER,
	user_id UUID,
	use_all BOOLEAN,
	allowed_processed_document_ids INTEGER[],
	allowed_folder_id INTEGER
);
