CREATE TABLE IF NOT EXISTS "public"."access_group_members" (
    "user_id" "uuid" NOT NULL,
    "access_group_id" "uuid" NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" (),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" ()
);

ALTER TABLE "public"."access_group_members" OWNER TO "postgres";

ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_user_access_group_key" UNIQUE ("user_id", "access_group_id");

CREATE OR REPLACE TRIGGER "auto_set_updated_at_for_access_group_members"
BEFORE INSERT OR UPDATE ON "public"."access_group_members" FOR EACH ROW
EXECUTE FUNCTION "public"."tg_set_updated_at" ();

GRANT ALL ON TABLE "public"."access_group_members" TO "anon";

GRANT ALL ON TABLE "public"."access_group_members" TO "authenticated";

GRANT ALL ON TABLE "public"."access_group_members" TO "service_role";
