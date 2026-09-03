CREATE TABLE IF NOT EXISTS "public"."maintenance_mode" (
    "onerow_id" BOOLEAN DEFAULT TRUE NOT NULL,
    "is_enabled" BOOLEAN DEFAULT FALSE NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT "now" () NOT NULL,
    CONSTRAINT "onerow_uni" CHECK ("onerow_id")
);

ALTER TABLE "public"."maintenance_mode" OWNER TO "postgres";

COMMENT ON TABLE "public"."maintenance_mode" IS 'Controls application-wide maintenance mode status';

COMMENT ON COLUMN "public"."maintenance_mode"."is_enabled" IS 'Whether maintenance mode is currently active';

COMMENT ON COLUMN "public"."maintenance_mode"."updated_at" IS 'When this record was last updated';

ALTER TABLE ONLY "public"."maintenance_mode"
ADD CONSTRAINT "maintenance_mode_pkey" PRIMARY KEY ("onerow_id");

CREATE OR REPLACE TRIGGER "trigger_prevent_maintenance_mode_delete"
BEFORE DELETE ON "public"."maintenance_mode" FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_maintenance_mode_delete" ();

CREATE OR REPLACE TRIGGER "trigger_prevent_maintenance_mode_truncate"
BEFORE TRUNCATE ON "public"."maintenance_mode" FOR EACH STATEMENT
EXECUTE FUNCTION "public"."prevent_maintenance_mode_truncate" ();

CREATE OR REPLACE TRIGGER "trigger_update_maintenance_mode_updated_at"
BEFORE UPDATE ON "public"."maintenance_mode" FOR EACH ROW
EXECUTE FUNCTION "public"."update_maintenance_mode_updated_at" ();

GRANT
SELECT
,
    REFERENCES,
    TRIGGER,
TRUNCATE ON TABLE "public"."maintenance_mode" TO "anon";

GRANT
SELECT
,
    REFERENCES,
    TRIGGER,
TRUNCATE ON TABLE "public"."maintenance_mode" TO "authenticated";

REVOKE INSERT,
UPDATE,
DELETE ON TABLE "public"."maintenance_mode"
FROM
    "anon";

REVOKE INSERT,
UPDATE,
DELETE ON TABLE "public"."maintenance_mode"
FROM
    "authenticated";

GRANT ALL ON TABLE "public"."maintenance_mode" TO "service_role";
