ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS parla_citations JSONB;
