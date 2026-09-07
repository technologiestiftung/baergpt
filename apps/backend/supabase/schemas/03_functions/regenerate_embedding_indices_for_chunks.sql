CREATE OR REPLACE FUNCTION "public"."regenerate_embedding_indices_for_chunks" () RETURNS "void" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
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
END;
$$;

ALTER FUNCTION "public"."regenerate_embedding_indices_for_chunks" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_chunks" () TO "anon";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_chunks" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."regenerate_embedding_indices_for_chunks" () TO "service_role";
