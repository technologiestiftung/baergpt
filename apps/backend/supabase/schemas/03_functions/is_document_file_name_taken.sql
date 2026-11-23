CREATE OR REPLACE FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER DEFAULT NULL) RETURNS BOOLEAN LANGUAGE "plpgsql" STABLE
SET
    "search_path" TO '' AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.file_name = p_file_name
          AND d.id IS DISTINCT FROM p_excluded_document_id
          AND (
              d.owned_by_user_id = p_user_id
              OR (
                  d.source_type = 'default_document'
                  AND d.owned_by_user_id IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM public.user_hidden_default_documents h
                      WHERE h.user_id = p_user_id AND h.document_id = d.id
                  )
              )
          )
    );
END;
$$;

ALTER FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER) TO "anon";

GRANT ALL ON FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER) TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_document_file_name_taken" ("p_user_id" "uuid", "p_file_name" "text", "p_excluded_document_id" INTEGER) TO "service_role";
