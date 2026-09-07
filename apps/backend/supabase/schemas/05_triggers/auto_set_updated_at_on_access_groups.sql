CREATE OR REPLACE TRIGGER "auto_set_updated_at_on_access_groups"
BEFORE INSERT OR UPDATE ON "public"."access_groups" FOR EACH ROW
EXECUTE FUNCTION "public"."tg_set_updated_at" ();
