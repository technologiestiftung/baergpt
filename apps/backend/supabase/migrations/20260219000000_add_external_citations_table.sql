-- Create external_citations table for storing citations from external sources like Parla
CREATE TABLE IF NOT EXISTS external_citations (
    id TEXT PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    snippet TEXT NOT NULL,
    page INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'parla_document',
    CONSTRAINT check_source_type CHECK (source_type IN ('parla_document'))
);

-- Add index for faster lookups by message_id
CREATE INDEX IF NOT EXISTS idx_external_citations_message_id ON external_citations (message_id);

-- Enable Row Level Security
ALTER TABLE external_citations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see external citations for messages in chats they own
CREATE POLICY select_external_citations_policy ON external_citations FOR
SELECT
    USING (
        EXISTS (
            SELECT
                1
            FROM
                chat_messages
                JOIN chats ON chats.id = chat_messages.chat_id
            WHERE
                chat_messages.id = external_citations.message_id
                AND chats.user_id = (
                    SELECT
                        auth.uid ()
                )
        )
    );

-- Policy: Users can only insert external citations for messages in chats they own
CREATE POLICY insert_external_citations_policy ON external_citations FOR INSERT
WITH
    CHECK (
        EXISTS (
            SELECT
                1
            FROM
                chat_messages
                JOIN chats ON chats.id = chat_messages.chat_id
            WHERE
                chat_messages.id = external_citations.message_id
                AND chats.user_id = (
                    SELECT
                        auth.uid ()
                )
        )
    );

-- Policy: Users can only delete external citations for messages in chats they own
CREATE POLICY delete_external_citations_policy ON external_citations FOR DELETE USING (
    EXISTS (
        SELECT
            1
        FROM
            chat_messages
            JOIN chats ON chats.id = chat_messages.chat_id
        WHERE
            chat_messages.id = external_citations.message_id
            AND chats.user_id = (
                SELECT
                    auth.uid ()
            )
    )
);
