CREATE OR REPLACE FUNCTION "public"."update_folder_id_cascading" () RETURNS "trigger" LANGUAGE "plpgsql"
SET
    "search_path" TO '' AS $$
BEGIN
    -- Update folder_id in document_chunks
UPDATE public.document_chunks
SET folder_id = NEW.folder_id
WHERE document_id = NEW.id;

-- Update folder_id in document_summaries
UPDATE public.document_summaries
SET folder_id = NEW.folder_id
WHERE document_id = NEW.id;

RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_folder_id_cascading" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."update_folder_id_cascading" () TO "anon";

GRANT ALL ON FUNCTION "public"."update_folder_id_cascading" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_folder_id_cascading" () TO "service_role";
