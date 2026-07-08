-- Add a per-user personal system prompt to profiles.
-- Injected into the global system prompt on every /just-chatting request.
-- Length is capped at 500 characters as defense-in-depth (the frontend also enforces this).
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS personal_system_prompt TEXT CONSTRAINT personal_system_prompt_length CHECK (CHAR_LENGTH(personal_system_prompt) <= 500);

COMMENT ON COLUMN profiles.personal_system_prompt IS 'User-defined personal system prompt, merged into the global system prompt on every chat request. NULL means none set.';
