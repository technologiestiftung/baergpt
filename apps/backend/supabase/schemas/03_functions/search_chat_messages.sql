CREATE OR REPLACE FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER DEFAULT 50) RETURNS TABLE (
    "chat_id" INTEGER,
    "chat_name" "text",
    "chat_user_id" "uuid",
    "chat_created_at" TIMESTAMP WITH TIME ZONE,
    "message_id" INTEGER,
    "message_content" "text",
    "message_created_at" TIMESTAMP WITH TIME ZONE
) LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
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

ALTER FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) TO "anon";

GRANT ALL ON FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) TO "authenticated";

GRANT ALL ON FUNCTION "public"."search_chat_messages" ("search_pattern" "text", "result_limit" INTEGER) TO "service_role";
