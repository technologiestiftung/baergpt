CREATE OR REPLACE TRIGGER "trg_maintain_chat_messages_folder_references"
BEFORE DELETE ON "public"."document_folders" FOR EACH ROW
EXECUTE FUNCTION "public"."maintain_chat_messages_folder_references" ();
