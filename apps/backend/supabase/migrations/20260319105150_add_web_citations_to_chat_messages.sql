ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS web_citations JSONB;
