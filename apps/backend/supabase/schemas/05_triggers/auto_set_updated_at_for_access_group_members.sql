CREATE OR REPLACE TRIGGER "auto_set_updated_at_for_access_group_members"
BEFORE INSERT OR UPDATE ON "public"."access_group_members" FOR EACH ROW
EXECUTE FUNCTION "public"."tg_set_updated_at" ();
