ALTER TABLE public.user_hidden_default_documents
DROP CONSTRAINT if EXISTS user_hidden_default_documents_user_id_fkey;

ALTER TABLE public.user_hidden_default_documents
ADD CONSTRAINT user_hidden_default_documents_user_id_fkey FOREIGN key (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE;
