CREATE OR REPLACE TRIGGER "trigger_prevent_maintenance_mode_truncate"
BEFORE TRUNCATE ON "public"."maintenance_mode" FOR EACH STATEMENT
EXECUTE FUNCTION "public"."prevent_maintenance_mode_truncate" ();
