-- Fix embedding index regeneration functions
-- Update table names, column names, and add search_path security
-- 1. Fix regenerate_embedding_indices_for_chunks
CREATE OR REPLACE FUNCTION public.regenerate_embedding_indices_for_chunks () returns void language plpgsql
SET
    search_path = '' AS $_$ 
BEGIN 
    DO $$
    DECLARE 
        index_name TEXT;
        numRows INT;
    BEGIN
        -- Delete old embedding indices first (check for both old and new naming patterns)
        FOR index_name IN
            SELECT indexname FROM pg_indexes 
            WHERE indexname LIKE '%document_chunks%embedding%' 
               OR indexname LIKE '%processed_document_chunks_embedding_idx%'
        LOOP
            EXECUTE 'DROP INDEX IF EXISTS ' || index_name;
        END LOOP;

        -- Generate new embedding indices
        SELECT GREATEST(1, ROUND(COUNT(*) / 1000)::INTEGER) INTO numRows FROM public.document_chunks;

        EXECUTE 'CREATE INDEX ON public.document_chunks USING ivfflat (chunk_jina_embedding vector_ip_ops) WITH (lists = ' || numRows || ')';
    END $$;
END;
$_$;

-- 2. Fix regenerate_embedding_indices_for_summaries  
CREATE OR REPLACE FUNCTION public.regenerate_embedding_indices_for_summaries () returns void language plpgsql
SET
    search_path = '' AS $_$
BEGIN 
    DO $$
    DECLARE 
        index_name TEXT;
        numRows INT;
    BEGIN 
        -- Delete old embedding indices first (check for both old and new naming patterns)
        FOR index_name IN
            SELECT indexname FROM pg_indexes 
            WHERE indexname LIKE '%document_summaries%embedding%' 
               OR indexname LIKE '%processed_document_summaries_embedding_idx%'
        LOOP
            EXECUTE 'DROP INDEX IF EXISTS ' || index_name;
        END LOOP;

        -- Generate new embedding indices
        SELECT GREATEST(1, ROUND(COUNT(*) / 1000)) INTO numRows FROM public.document_summaries;

        EXECUTE 'CREATE INDEX ON public.document_summaries USING ivfflat (summary_jina_embedding vector_ip_ops) WITH (lists = ' || numRows || ')';
    END $$;
END;
$_$;
