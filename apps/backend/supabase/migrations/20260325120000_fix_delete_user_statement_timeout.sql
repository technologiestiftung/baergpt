-- Fix 57014 timeout in delete_user(): add GIN index on
-- chat_messages.allowed_document_ids so the per-document trigger update
-- uses an index scan instead of a full sequential scan.
-- Also raises delete_user() timeout to 60s as defense in depth.
CREATE INDEX idx_chat_messages_allowed_document_ids_gin ON public.chat_messages USING gin (allowed_document_ids);

-- The function-level SET overrides PostgREST's session-level 8s timeout.
CREATE OR REPLACE FUNCTION public.delete_user () RETURNS void LANGUAGE sql SECURITY DEFINER
SET
    search_path = ''
SET
    statement_timeout TO '60000' AS $$
    DELETE FROM auth.users WHERE id = auth.uid();
$$;
