CREATE OR REPLACE TRIGGER "trg_dedupe_document_file_name"
BEFORE INSERT ON "public"."documents" FOR EACH ROW WHEN (
    ("new"."owned_by_user_id" IS NOT NULL)
    AND ("new"."file_name" IS NOT NULL)
)
EXECUTE FUNCTION "public"."dedupe_document_file_name" ();
