CREATE OR REPLACE TRIGGER "trg_update_folder_id_cascading"
AFTER UPDATE OF "folder_id" ON "public"."documents" FOR EACH ROW WHEN (("old"."folder_id" IS DISTINCT FROM "new"."folder_id"))
EXECUTE FUNCTION "public"."update_folder_id_cascading" ();
