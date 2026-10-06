CREATE OR REPLACE FUNCTION "public"."maintain_chat_messages_folder_references" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    -- Only proceed if this is a DELETE operation
    IF TG_OP = 'DELETE' THEN
        -- Update only chat_messages where the chat still exists
UPDATE public.chat_messages cm
SET allowed_folder_ids = array_remove(cm.allowed_folder_ids, OLD.id)
WHERE
  -- The message references the deleted document
    cm.allowed_folder_ids @> ARRAY[OLD.id]
  -- AND the chat still exists (to avoid foreign key errors)
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = cm.chat_id
    -- NOTE: There is an edge-case that is difficult to simulate,
    -- but has occurred in the past: if an account with many folders / chats
    -- is deleted, there can be a race condition where chats are deleted before
    -- folders. If the function then gets executed and tries to update
    -- `chat_messages` for chats that no longer exist, it raises a
    -- foreign key violation error.
);
RETURN OLD;
END IF;
RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."maintain_chat_messages_folder_references" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_folder_references" () TO "anon";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_folder_references" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."maintain_chat_messages_folder_references" () TO "service_role";
