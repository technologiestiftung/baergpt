-- Create external_citations table for storing citations from external sources like Parla
CREATE TABLE IF NOT EXISTS external_citations (
    id TEXT PRIMARY KEY,
    snippet TEXT NOT NULL,
    page INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'parla_document',
    CONSTRAINT check_source_type CHECK (source_type IN ('parla_document'))
);

-- Enable Row Level Security
ALTER TABLE external_citations ENABLE ROW LEVEL SECURITY;

-- Add INSERT policy for external_citations
-- This allows authenticated users to insert external citations.
-- The SELECT policy ensures users can only see citations linked to their messages.
-- Cleanup happens via the cascade delete trigger on chat_message_citations.
CREATE POLICY insert_external_citations_policy ON public.external_citations FOR INSERT
WITH
    CHECK (
        -- Allow authenticated users to insert external citations
        -- The linkage to messages happens via chat_message_citations
        (
            SELECT
                auth.uid ()
        ) IS NOT NULL
    );
