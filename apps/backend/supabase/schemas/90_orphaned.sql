-- Objects with no resolvable owning table (e.g. a sequence left behind by a dropped table).
-- Kept so nothing from the original dump is silently lost -- review and decide whether to
-- drop them via a migration instead of carrying them forward declaratively.
CREATE SEQUENCE IF NOT EXISTS "public"."user_requests_id_seq" START
WITH
    1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "public"."user_requests_id_seq" OWNER TO "postgres";

GRANT ALL ON SEQUENCE "public"."user_requests_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."user_requests_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."user_requests_id_seq" TO "service_role";
