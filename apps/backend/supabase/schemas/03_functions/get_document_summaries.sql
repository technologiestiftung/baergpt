CREATE OR REPLACE FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) RETURNS TABLE ("id" INTEGER, "file_name" "text", "created_at" TIMESTAMP WITH TIME ZONE, "short_summary" "text") LANGUAGE "plpgsql" STABLE
SET
    "search_path" TO '' AS $$
BEGIN
RETURN QUERY
SELECT
    d.id,
    d.file_name,
    d.created_at,
    ds.short_summary
FROM public.documents d
         LEFT JOIN public.document_summaries ds ON ds.document_id = d.id
WHERE
    d.id = ANY(input_document_ids)
   OR d.folder_id = ANY(input_folder_ids);
END;
$$;

ALTER FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) TO "anon";

GRANT ALL ON FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_document_summaries" ("input_document_ids" INTEGER[], "input_folder_ids" INTEGER[]) TO "service_role";
