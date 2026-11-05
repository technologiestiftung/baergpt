CREATE OR REPLACE TRIGGER "auto_set_updated_at_on_user_integration_keys"
BEFORE INSERT OR UPDATE ON "public"."user_integration_keys" FOR EACH ROW
EXECUTE FUNCTION "public"."tg_set_updated_at" ();
