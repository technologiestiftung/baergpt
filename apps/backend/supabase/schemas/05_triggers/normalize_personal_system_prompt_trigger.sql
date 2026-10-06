CREATE OR REPLACE TRIGGER "normalize_personal_system_prompt_trigger"
BEFORE INSERT OR UPDATE OF "personal_system_prompt" ON "public"."profiles" FOR EACH ROW
EXECUTE FUNCTION "public"."normalize_personal_system_prompt" ();
