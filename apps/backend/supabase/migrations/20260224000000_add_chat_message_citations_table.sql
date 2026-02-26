-- 1. Create chat_message_citations table (unified abstraction for all citation types)
CREATE TABLE IF NOT EXISTS chat_message_citations (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    document_chunk_ids INTEGER[] NOT NULL DEFAULT '{}',
    external_citation_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_single_citation_source CHECK (COALESCE(CARDINALITY(document_chunk_ids), 0) + COALESCE(CARDINALITY(external_citation_ids), 0) <= 1)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_citations_message_id ON chat_message_citations (message_id);

ALTER TABLE chat_message_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_chat_message_citations_policy ON chat_message_citations FOR
SELECT
    USING (
        EXISTS (
            SELECT
                1
            FROM
                chat_messages
                JOIN chats ON chats.id = chat_messages.chat_id
            WHERE
                chat_messages.id = chat_message_citations.message_id
                AND chats.user_id = (
                    SELECT
                        auth.uid ()
                )
        )
    );

CREATE POLICY insert_chat_message_citations_policy ON chat_message_citations FOR INSERT
WITH
    CHECK (
        EXISTS (
            SELECT
                1
            FROM
                chat_messages
                JOIN chats ON chats.id = chat_messages.chat_id
            WHERE
                chat_messages.id = chat_message_citations.message_id
                AND chats.user_id = (
                    SELECT
                        auth.uid ()
                )
        )
    );

CREATE POLICY delete_chat_message_citations_policy ON chat_message_citations FOR DELETE USING (
    EXISTS (
        SELECT
            1
        FROM
            chat_messages
            JOIN chats ON chats.id = chat_messages.chat_id
        WHERE
            chat_messages.id = chat_message_citations.message_id
            AND chats.user_id = (
                SELECT
                    auth.uid ()
            )
    )
);

-- 2. Migrate old citations JSON array into chat_message_citations rows,
--    then rewrite chat_messages.citations to hold the new row IDs.
DO $$
DECLARE
    msg RECORD;
    citation_element JSONB;
    new_citation_id BIGINT;
    new_citation_ids BIGINT[];
    migrated_messages INT := 0;
    migrated_citations INT := 0;
    skipped_elements INT := 0;
BEGIN
    FOR msg IN
        SELECT id, citations
        FROM public.chat_messages
        WHERE citations IS NOT NULL
          AND citations != 'null'::jsonb
          AND jsonb_array_length(citations) > 0
    LOOP
        new_citation_ids := '{}';

        FOR citation_element IN
            SELECT * FROM jsonb_array_elements(msg.citations)
        LOOP
            IF jsonb_typeof(citation_element) = 'number' THEN
                INSERT INTO public.chat_message_citations (message_id, document_chunk_ids)
                VALUES (msg.id, ARRAY[citation_element::text::integer])
                RETURNING id INTO new_citation_id;
                migrated_citations := migrated_citations + 1;
            ELSE
                skipped_elements := skipped_elements + 1;
                CONTINUE;
            END IF;

            new_citation_ids := array_append(new_citation_ids, new_citation_id);
        END LOOP;

        migrated_messages := migrated_messages + 1;
    END LOOP;

    RAISE NOTICE 'Citation migration complete: % messages migrated, % citation rows created, % elements skipped',
        migrated_messages, migrated_citations, skipped_elements;
END;
$$;

-- 2.5 Create policies using the link via chat_message_citations
CREATE POLICY select_external_citations_policy ON public.external_citations FOR
SELECT
    USING (
        EXISTS (
            SELECT
                1
            FROM
                public.chat_message_citations cmc
                JOIN public.chat_messages cm ON cm.id = cmc.message_id
                JOIN public.chats c ON c.id = cm.chat_id
            WHERE
                public.external_citations.id = ANY (cmc.external_citation_ids)
                AND c.user_id = (
                    SELECT
                        auth.uid ()
                )
        )
    );

-- 2.6 Create trigger to cascade delete external citations when chat_message_citations are deleted
CREATE OR REPLACE FUNCTION delete_referenced_external_citations () RETURNS TRIGGER AS $$
BEGIN
    IF OLD.external_citation_ids IS NOT NULL AND array_length(OLD.external_citation_ids, 1) > 0 THEN
        DELETE FROM public.external_citations WHERE id = ANY(OLD.external_citation_ids);
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET
    search_path = '';

DROP TRIGGER IF EXISTS trigger_delete_external_citations ON chat_message_citations;

CREATE TRIGGER trigger_delete_external_citations
AFTER DELETE ON chat_message_citations FOR EACH ROW
EXECUTE FUNCTION delete_referenced_external_citations ();

-- 3. Create function to get citation details for given citation IDs
-- This function accepts citation_ids from the chat_message_citations table
-- and returns details by joining to either document_chunks or external_citations
CREATE OR REPLACE FUNCTION get_citation_details (citation_ids BIGINT[]) RETURNS TABLE (
    citation_id BIGINT,
    file_name TEXT,
    source_url TEXT,
    page INT,
    created_at TIMESTAMPTZ,
    source_type TEXT,
    snippet TEXT
) LANGUAGE plpgsql SECURITY INVOKER
SET
    search_path = '' AS $$
BEGIN
    RETURN QUERY
    -- Document chunk citations
    SELECT
        cmc.id AS citation_id,
        doc.file_name,
        doc.source_url,
        dc.page,
        doc.created_at,
        doc.source_type,
        dc.content AS snippet
    FROM public.chat_message_citations cmc
    CROSS JOIN LATERAL unnest(cmc.document_chunk_ids) AS chunk_id
    JOIN public.document_chunks dc ON dc.id = chunk_id
    JOIN public.documents doc ON doc.id = dc.document_id
    WHERE cmc.id = ANY(citation_ids)
    AND cmc.document_chunk_ids != '{}'

    UNION ALL

    -- External citations
    SELECT
        cmc.id AS citation_id,
        ec.file_name,
        ec.source_url,
        ec.page,
        ec.created_at,
        ec.source_type,
        ec.snippet
    FROM public.chat_message_citations cmc
    CROSS JOIN LATERAL unnest(cmc.external_citation_ids) AS ext_id
    JOIN public.external_citations ec ON ec.id = ext_id
    WHERE cmc.id = ANY(citation_ids)
    AND cmc.external_citation_ids != '{}';
END;
$$;
