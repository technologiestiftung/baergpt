CREATE SEQUENCE IF NOT EXISTS "public"."user_requests_id_seq" START
WITH
    1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "public"."user_requests_id_seq" OWNER TO "postgres";

GRANT ALL ON SEQUENCE "public"."user_requests_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."user_requests_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."user_requests_id_seq" TO "service_role";
