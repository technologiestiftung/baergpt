CREATE OR REPLACE TRIGGER "trg_maintain_chat_messages_document_references"
BEFORE DELETE ON "public"."documents" FOR EACH ROW
EXECUTE FUNCTION "public"."maintain_chat_messages_document_references" ();
