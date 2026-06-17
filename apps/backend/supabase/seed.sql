-- Test/dev seed data. Runs locally (db reset / supabase start) and in CI, but is
-- never pushed to prod (prod applies migrations only). Keep test-only data here.
-- Allowlisted email domains used by integration/e2e tests. These are not real
-- Verwaltung domains, so they must NOT live in a migration.
INSERT INTO
    public.allowed_email_domains (domain)
VALUES
    ('local.berlin.de'),
    ('new.berlin.de')
ON CONFLICT (domain) DO NOTHING;
