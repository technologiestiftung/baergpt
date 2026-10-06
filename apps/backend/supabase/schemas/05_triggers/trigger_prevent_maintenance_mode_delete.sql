CREATE OR REPLACE TRIGGER "trigger_prevent_maintenance_mode_delete"
BEFORE DELETE ON "public"."maintenance_mode" FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_maintenance_mode_delete" ();
