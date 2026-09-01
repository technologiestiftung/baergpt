ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "public"."access_groups" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."access_group_members"
ADD CONSTRAINT "access_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."access_groups"
ADD CONSTRAINT "access_groups_subset_of_fkey" FOREIGN KEY ("subset_of") REFERENCES "public"."access_groups" ("id");

ALTER TABLE ONLY "public"."allowed_email_domains"
ADD CONSTRAINT "allowed_email_domains_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."allowed_email_domains"
ADD CONSTRAINT "allowed_email_domains_last_status_change_by_fkey" FOREIGN KEY ("last_status_change_by") REFERENCES "auth"."users" ("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."allowed_individual_emails"
ADD CONSTRAINT "allowed_individual_emails_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users" ("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."application_admins"
ADD CONSTRAINT "application_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."chat_messages"
ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."chats"
ADD CONSTRAINT "chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."document_chunks"
ADD CONSTRAINT "document_chunks_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "public"."access_groups" ("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."document_chunks"
ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."document_folders"
ADD CONSTRAINT "document_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."document_summaries"
ADD CONSTRAINT "document_summaries_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "public"."access_groups" ("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."document_summaries"
ADD CONSTRAINT "document_summaries_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."documents"
ADD CONSTRAINT "documents_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "public"."access_groups" ("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."documents"
ADD CONSTRAINT "documents_owner_user_id_fkey" FOREIGN KEY ("owned_by_user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."documents"
ADD CONSTRAINT "documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "auth"."users" ("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."favorite_documents"
ADD CONSTRAINT "favorite_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_hidden_default_documents"
ADD CONSTRAINT "user_hidden_default_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents" ("id");

ALTER TABLE ONLY "public"."user_hidden_default_documents"
ADD CONSTRAINT "user_hidden_default_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles" ("id") ON DELETE CASCADE;
