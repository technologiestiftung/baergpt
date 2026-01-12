-- Create table for allowed email domains
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (id serial PRIMARY KEY, domain TEXT NOT NULL UNIQUE);

-- Add RLS policies
ALTER TABLE public.allowed_email_domains enable ROW level security;

-- Allow read access for all users (needed for registration validation)
CREATE POLICY "Allow read access for all users" ON public.allowed_email_domains FOR
SELECT
    USING (TRUE);

-- Insert the allowed domains
INSERT INTO
    public.allowed_email_domains (domain)
VALUES
    ('*.berlin.de'),
    ('bezirksamt-neukoelln.de'),
    ('charlottenburg-wilmersdorf.de'),
    ('parlament-berlin.de'),
    ('berliner-feuerwehr.de'),
    ('statistik-bbb.de'),
    ('ts.berlin');

-- Add comment to the table
comment ON TABLE public.allowed_email_domains IS 'Table containing allowed email domains for user registration';
