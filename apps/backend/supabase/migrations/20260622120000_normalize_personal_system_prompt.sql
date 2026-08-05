-- Trigger to normalise the personal system prompt on write.
-- Trim surrounding whitespace, new lines and tabs. Collapse empty/whitespace-only values to NULL.
CREATE OR REPLACE FUNCTION public.normalize_personal_system_prompt () RETURNS TRIGGER LANGUAGE plpgsql
SET
    search_path = '' AS $$
BEGIN
	NEW.personal_system_prompt := NULLIF(
		regexp_replace(NEW.personal_system_prompt, '^\s+|\s+$', '', 'g'),
		''
	);
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_personal_system_prompt_trigger ON public.profiles;

CREATE TRIGGER normalize_personal_system_prompt_trigger
BEFORE INSERT OR UPDATE OF personal_system_prompt ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.normalize_personal_system_prompt ();

-- Backfill existing rows to the normalized form.
UPDATE public.profiles
SET
    personal_system_prompt = NULLIF(REGEXP_REPLACE(personal_system_prompt, '^\s+|\s+$', '', 'g'), '')
WHERE
    personal_system_prompt IS NOT NULL;
