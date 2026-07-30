CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Leading-wildcard ILIKE (search_chat_messages below) can't use a btree
-- index; the trigram GIN index keeps it fast as chat_messages grows.
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_trgm ON public.chat_messages USING gin (content extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_chat_messages (search_pattern TEXT, result_limit INTEGER DEFAULT 50) returns TABLE (
    chat_id INTEGER,
    chat_name TEXT,
    chat_user_id UUID,
    chat_created_at TIMESTAMPTZ,
    message_id INTEGER,
    message_content TEXT,
    message_created_at TIMESTAMPTZ
) language plpgsql security invoker
SET
    search_path = '' AS $$
BEGIN
	RETURN QUERY
		SELECT
			c.id AS chat_id,
			c.name AS chat_name,
			c.user_id AS chat_user_id,
			c.created_at AS chat_created_at,
			cm.id AS message_id,
			cm.content AS message_content,
			cm.created_at AS message_created_at
		FROM public.chat_messages cm
		JOIN public.chats c ON c.id = cm.chat_id
		WHERE cm.content ILIKE search_pattern
		ORDER BY cm.created_at DESC
		LIMIT result_limit;
END;
$$;
