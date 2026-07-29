-- Remove the seeded 'init.de' domain from the allowed email domains.
DELETE FROM public.allowed_email_domains
WHERE
    domain = 'init.de';
