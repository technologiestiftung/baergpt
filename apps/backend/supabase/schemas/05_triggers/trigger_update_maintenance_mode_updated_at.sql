CREATE OR REPLACE TRIGGER "trigger_update_maintenance_mode_updated_at"
BEFORE UPDATE ON "public"."maintenance_mode" FOR EACH ROW
EXECUTE FUNCTION "public"."update_maintenance_mode_updated_at" ();
