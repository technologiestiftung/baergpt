CREATE OR REPLACE FUNCTION "public"."normalize_personal_system_prompt" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $_$
BEGIN
	NEW.personal_system_prompt := NULLIF(
		regexp_replace(NEW.personal_system_prompt, '^\s+|\s+$', '', 'g'),
		''
	);
RETURN NEW;
END;
$_$;

ALTER FUNCTION "public"."normalize_personal_system_prompt" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."normalize_personal_system_prompt" () TO "anon";

GRANT ALL ON FUNCTION "public"."normalize_personal_system_prompt" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."normalize_personal_system_prompt" () TO "service_role";
