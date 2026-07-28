-- Flags whether a message belongs to the external-tool context, so only external-tool
-- messages (plus the current one) reach the model when an external tool is active.
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS external_tool_context BOOLEAN NOT NULL DEFAULT FALSE;
