-- Add a column to persist the UUID-based preview file path, generated at
-- upload time instead of derived from the original filename (which could
-- collide with an unrelated pre-existing file of the same base name).
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS preview_source_url TEXT;
