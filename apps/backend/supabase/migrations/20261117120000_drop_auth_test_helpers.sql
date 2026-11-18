DROP FUNCTION IF EXISTS "public"."update_user_email_confirmed_at" ("user_id" "uuid", "new_email_confirmed_at" TIMESTAMP WITH TIME ZONE);

DROP FUNCTION IF EXISTS "public"."update_user_last_sign_in_at" ("user_id" "uuid", "new_last_sign_in_at" TIMESTAMP WITH TIME ZONE);
