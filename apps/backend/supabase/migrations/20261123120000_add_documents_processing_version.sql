ALTER TABLE "public"."documents"
ADD COLUMN IF NOT EXISTS "processing_version" INTEGER;
