CREATE OR REPLACE TRIGGER "add_new_user_to_access_group_trigger"
AFTER INSERT ON "public"."profiles" FOR EACH ROW
EXECUTE FUNCTION "public"."add_user_to_access_group" ();
