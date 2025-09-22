CREATE OR REPLACE FUNCTION public.regenerate_embedding_indices_for_chunks () returns void language plpgsql AS $function$ 

BEGIN 

DO $$
DECLARE 
    index_name TEXT;
    numRows INT;

BEGIN
    -- Delete old embedding indices first
    FOR index_name IN
        SELECT indexname FROM pg_indexes WHERE indexname LIKE '%processed_document_chunks_embedding_idx%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || index_name;
    END LOOP;

    -- Generate new embedding indices
    SELECT ROUND(COUNT(*) / 1000) INTO numRows FROM processed_document_chunks;

    EXECUTE 'CREATE INDEX ON processed_document_chunks USING ivfflat (embedding vector_ip_ops) WITH (lists = ' || numRows || ')';
END $$;

END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_embedding_indices_for_summaries () returns void language plpgsql AS $function$
BEGIN 

DO $$
DECLARE 
    index_name TEXT;
    numRows INT;
BEGIN 
    -- Delete old embedding indices first
    FOR index_name IN
        SELECT indexname FROM pg_indexes WHERE indexname LIKE '%processed_document_summaries_embedding_idx%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || index_name;
    END LOOP;

    -- Generate new embedding indices
    SELECT ROUND(COUNT(*) / 1000) INTO numRows FROM processed_document_summaries;

    EXECUTE 'CREATE INDEX ON processed_document_summaries USING ivfflat (summary_embedding vector_ip_ops) WITH (lists = ' || numRows || ')';
END $$;

END;
$function$
