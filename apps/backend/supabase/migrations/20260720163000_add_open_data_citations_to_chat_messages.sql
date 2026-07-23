ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS open_data_citations JSONB;
