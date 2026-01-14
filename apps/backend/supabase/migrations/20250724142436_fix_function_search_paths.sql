-- Fix Function Search Path Mutable security warnings
-- Add SET search_path = '' and fully qualify table names
-- 1. change_value_for_user_by
CREATE OR REPLACE FUNCTION public.change_value_for_user_by (
	amount INTEGER,
	column_name TEXT,
	user_id_to_update UUID
) returns void language plpgsql
SET
	search_path = '' AS $_$
BEGIN
  EXECUTE format('UPDATE public.profiles SET %I = %I + $1 WHERE id = $2', column_name, column_name)
  USING amount, user_id_to_update;
END;
$_$;

-- 2. find_unprocessed_documents  
CREATE OR REPLACE FUNCTION public.find_unprocessed_documents () returns TABLE (
	id INTEGER,
	owned_by_user_id UUID,
	source_url TEXT,
	source_type TEXT,
	file_name TEXT,
	file_checksum TEXT,
	file_size INTEGER,
	num_pages INTEGER,
	folder_id INTEGER,
	processing_finished_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE
) language sql stable
SET
	search_path = '' AS $$
  SELECT id, owned_by_user_id, source_url, source_type, file_name, file_checksum, file_size, num_pages, folder_id, processing_finished_at, created_at
    FROM public.documents
   WHERE processing_finished_at IS NULL;
$$;

-- 3. is_application_admin
CREATE OR REPLACE FUNCTION public.is_application_admin () returns BOOLEAN language sql security definer
SET
	search_path = '' AS $$
select exists (
    select 1
    from public.application_admins
    where user_id = auth.uid()
);
$$;

-- 4. generate_short_id
CREATE OR REPLACE FUNCTION public.generate_short_id () returns trigger language plpgsql
SET
	search_path = '' AS $$
BEGIN
  NEW.short_id := id_encode(NEW.id);
  RETURN NEW;
END;
$$;

-- 5. maintain_chat_messages_document_references
CREATE OR REPLACE FUNCTION public.maintain_chat_messages_document_references () returns trigger language plpgsql
SET
	search_path = '' AS $$
BEGIN
    -- When a document is deleted, remove it from all allowed_document_ids arrays
    IF TG_OP = 'DELETE' THEN
        UPDATE public.chat_messages
        SET allowed_document_ids = array_remove(allowed_document_ids, OLD.id)
        WHERE allowed_document_ids @> ARRAY[OLD.id];
        RETURN OLD;
    END IF;

    -- No special handling needed for updates as the document ID remains the same
    RETURN NEW;
END;
$$;

-- 6. maintain_chat_messages_folder_references
CREATE OR REPLACE FUNCTION public.maintain_chat_messages_folder_references () returns trigger language plpgsql
SET
	search_path = '' AS $$
BEGIN
    -- When a folder is deleted, remove it from all allowed_folder_ids arrays
    IF TG_OP = 'DELETE' THEN
        UPDATE public.chat_messages
        SET allowed_folder_ids = array_remove(allowed_folder_ids, OLD.id)
        WHERE allowed_folder_ids @> ARRAY[OLD.id];
        RETURN OLD;
    END IF;

    -- No special handling needed for updates as the folder ID remains the same
    RETURN NEW;
END;
$$;

-- 7. match_jina_document_chunks
CREATE OR REPLACE FUNCTION public.match_jina_document_chunks (
	query_embedding extensions.vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	search_type TEXT,
	allowed_document_ids INTEGER[],
	allowed_folder_id INTEGER[] DEFAULT NULL::INTEGER[]
) returns TABLE (
	id INTEGER,
	document_id INTEGER,
	content TEXT,
	similarity DOUBLE PRECISION
) language plpgsql
SET
	search_path = '' AS $$
BEGIN
  EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, (dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1 AS similarity
  FROM public.document_chunks dc
  WHERE ((search_type='favorites' AND dc.document_id=ANY(allowed_document_ids)) OR (search_type='all_private' AND dc.owned_by_user_id=user_id)
    OR (search_type='private_folder' AND dc.owned_by_user_id=user_id AND dc.folder_id=ANY(allowed_folder_id))
    OR (search_type='public_only' AND dc.owned_by_user_id IS NULL))
    AND (dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1>match_threshold
  ORDER BY dc.chunk_jina_embedding OPERATOR(extensions.<#>) query_embedding LIMIT match_count;
END;
$$;

-- 8. match_jina_summaries
CREATE OR REPLACE FUNCTION public.match_jina_summaries (
	query_embedding extensions.vector,
	match_threshold DOUBLE PRECISION,
	match_count INTEGER,
	num_probes INTEGER,
	user_id UUID,
	search_type TEXT,
	allowed_document_ids INTEGER[],
	allowed_folder_ids INTEGER[] DEFAULT NULL::INTEGER[]
) returns TABLE (
	id INTEGER,
	document_id INTEGER,
	summary TEXT,
	similarity DOUBLE PRECISION
) language plpgsql
SET
	search_path = '' AS $$
BEGIN
  EXECUTE format('SET LOCAL ivfflat.probes = %s', num_probes);
  RETURN QUERY
  SELECT ds.id, ds.document_id, ds.summary, (ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1 AS similarity
  FROM public.document_summaries ds
  WHERE ((search_type='favorites' AND ds.document_id=ANY(allowed_document_ids)) OR (search_type='all_private' AND ds.owned_by_user_id=user_id)
    OR (search_type='private_folder' AND ds.owned_by_user_id=user_id AND ds.folder_id=ANY(allowed_folder_ids))
    OR (search_type='public_only' AND ds.owned_by_user_id IS NULL))
    AND (ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding)*-1>match_threshold
  ORDER BY ds.summary_jina_embedding OPERATOR(extensions.<#>) query_embedding LIMIT match_count;
END;
$$;

-- 9. match_jina_summaries_and_chunks
CREATE OR REPLACE FUNCTION public.match_jina_summaries_and_chunks (
	query_embedding extensions.vector,
	match_threshold DOUBLE PRECISION,
	chunk_limit INTEGER,
	summary_limit INTEGER,
	num_probes_chunks INTEGER,
	num_probes_summaries INTEGER,
	user_id UUID,
	allowed_document_ids INTEGER[],
	search_type TEXT,
	allowed_folder_ids INTEGER[] DEFAULT NULL::INTEGER[]
) returns TABLE (
	document_id INTEGER,
	chunk_ids INTEGER[],
	chunk_similarities DOUBLE PRECISION[],
	avg_chunk_similarity DOUBLE PRECISION,
	summary_ids INTEGER[],
	summary_similarity DOUBLE PRECISION,
	similarity DOUBLE PRECISION
) language plpgsql
SET
	search_path = '' AS $$
BEGIN
  RETURN QUERY WITH chunk_winners AS (
    SELECT cw.id AS chunk_id, NULL::integer AS summary_id, cw.document_id, cw.similarity
    FROM public.match_jina_document_chunks(query_embedding,match_threshold,chunk_limit,num_probes_chunks,user_id,search_type,allowed_document_ids,allowed_folder_ids) cw
  ), summary_winners AS (
    SELECT NULL::integer AS chunk_id, sw.id AS summary_id, sw.document_id, sw.similarity
    FROM public.match_jina_summaries(query_embedding,match_threshold,summary_limit,num_probes_summaries,user_id,search_type,allowed_document_ids,allowed_folder_ids) sw
  ), all_winners AS (
    SELECT * FROM chunk_winners UNION ALL SELECT * FROM summary_winners
  )
  SELECT winners.document_id, ARRAY_AGG(winners.chunk_id) FILTER(WHERE winners.chunk_id IS NOT NULL),
    ARRAY_AGG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL), AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),
    ARRAY_AGG(winners.summary_id) FILTER(WHERE winners.summary_id IS NOT NULL), AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),
    CASE WHEN COUNT(winners.chunk_id)=0 THEN COALESCE(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),0)
      WHEN COUNT(winners.summary_id)=0 THEN COALESCE(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),0)
      ELSE (COALESCE(AVG(winners.similarity) FILTER(WHERE winners.chunk_id IS NOT NULL),0)+COALESCE(AVG(winners.similarity) FILTER(WHERE winners.summary_id IS NOT NULL),0))/2 END
    AS similarity
  FROM all_winners winners GROUP BY winners.document_id ORDER BY similarity DESC;
END;
$$;
