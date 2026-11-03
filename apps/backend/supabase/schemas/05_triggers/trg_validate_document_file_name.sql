CREATE OR REPLACE TRIGGER "trg_validate_document_file_name"
BEFORE UPDATE OF "file_name" ON "public"."documents" FOR EACH ROW WHEN (("old"."file_name" IS DISTINCT FROM "new"."file_name"))
EXECUTE FUNCTION "public"."validate_document_file_name" ();
