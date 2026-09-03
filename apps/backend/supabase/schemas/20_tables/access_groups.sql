CREATE TABLE IF NOT EXISTS "public"."access_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid" () NOT NULL,
    "name" "text" NOT NULL,
    "subset_of" "uuid",
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" (),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" ()
);

ALTER TABLE "public"."access_groups" OWNER TO "postgres";

ALTER TABLE ONLY "public"."access_groups"
ADD CONSTRAINT "access_groups_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."access_groups"
ADD CONSTRAINT "access_groups_pkey" PRIMARY KEY ("id");

CREATE OR REPLACE TRIGGER "auto_set_updated_at_on_access_groups"
BEFORE INSERT OR UPDATE ON "public"."access_groups" FOR EACH ROW
EXECUTE FUNCTION "public"."tg_set_updated_at" ();

GRANT ALL ON TABLE "public"."access_groups" TO "anon";

GRANT ALL ON TABLE "public"."access_groups" TO "authenticated";

GRANT ALL ON TABLE "public"."access_groups" TO "service_role";
