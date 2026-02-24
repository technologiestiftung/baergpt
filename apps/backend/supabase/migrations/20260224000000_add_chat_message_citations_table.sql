-- 1. Create chat_message_citations table (unified abstraction for all citation types)
CREATE TABLE IF NOT EXISTS chat_message_citations (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    document_chunk_ids INTEGER[] NOT NULL DEFAULT '{}',
    external_citation_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- 2. Migrate existing data from the old mixed-type citations format
DO $$
DECLARE
    msg RECORD;
    citation_element JSONB;
    new_citation_id BIGINT;
    new_citation_ids BIGINT[];
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
            ELSIF jsonb_typeof(citation_element) = 'string' THEN
                INSERT INTO public.chat_message_citations (message_id, external_citation_ids)
                VALUES (msg.id, ARRAY[citation_element #>> '{}'])
                RETURNING id INTO new_citation_id;
            ELSE
                CONTINUE;
            END IF;

            new_citation_ids := array_append(new_citation_ids, new_citation_id);
        END LOOP;

        UPDATE public.chat_messages
        SET citations = to_jsonb(new_citation_ids)
        WHERE id = msg.id;
    END LOOP;
END;
$$;

-- 3. Replace get_citation_details to resolve both document chunks and external citations
DROP FUNCTION IF EXISTS get_citation_details (INTEGER[]);

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

-- 4. Drop the old function (no longer needed with unified approach)
DROP FUNCTION IF EXISTS get_external_citations_for_messages;
