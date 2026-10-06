CREATE OR REPLACE FUNCTION "public"."find_unprocessed_documents" () RETURNS TABLE (
    "id" INTEGER,
    "owned_by_user_id" "uuid",
    "source_url" "text",
    "source_type" "text",
    "file_name" "text",
    "file_checksum" "text",
    "file_size" INTEGER,
    "num_pages" INTEGER,
    "folder_id" INTEGER,
    "processing_finished_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE
) LANGUAGE "sql" STABLE
SET
    "search_path" TO '' AS $$
SELECT id, owned_by_user_id, source_url, source_type, file_name, file_checksum, file_size, num_pages, folder_id, processing_finished_at, created_at
FROM public.documents
WHERE processing_finished_at IS NULL;
$$;

ALTER FUNCTION "public"."find_unprocessed_documents" () OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."find_unprocessed_documents" () TO "anon";

GRANT ALL ON FUNCTION "public"."find_unprocessed_documents" () TO "authenticated";

GRANT ALL ON FUNCTION "public"."find_unprocessed_documents" () TO "service_role";
