-- Drop existing FK constraints (added without ON DELETE SET NULL in the previous migration)
ALTER TABLE public.allowed_email_domains
DROP CONSTRAINT IF EXISTS allowed_email_domains_created_by_fkey;

ALTER TABLE public.allowed_email_domains
DROP CONSTRAINT IF EXISTS allowed_email_domains_last_status_change_by_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE public.allowed_email_domains
ADD CONSTRAINT allowed_email_domains_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.allowed_email_domains
ADD CONSTRAINT allowed_email_domains_last_status_change_by_fkey FOREIGN KEY (last_status_change_by) REFERENCES auth.users (id) ON DELETE SET NULL;
