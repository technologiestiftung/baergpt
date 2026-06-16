-- Extend allowed_email_domains for runtime admin management: add activation and
-- audit columns, retire the legacy wildcard, and add the exact-format constraint.
-- The curated domains are seeded in the following migration; admins own the rows after that.
-- Remove the legacy wildcard and stale domains no longer in the curated list
-- (existing users are unaffected; only blocks new signups from these)
DELETE FROM public.allowed_email_domains
WHERE
    domain IN ('*.berlin.de', 'lbv.brandenburg.de');

-- Add activation and audit columns (defaults keep the ALTER safe on existing rows)
ALTER TABLE public.allowed_email_domains
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.allowed_email_domains
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.allowed_email_domains
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users (id);

ALTER TABLE public.allowed_email_domains
ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMPTZ;

ALTER TABLE public.allowed_email_domains
ADD COLUMN IF NOT EXISTS last_status_change_by UUID REFERENCES auth.users (id);

-- Backfill created_at on the pre-existing seed rows to the date of the migration that
-- originally inserted each domain (the DEFAULT now() above stamped them with today)
UPDATE public.allowed_email_domains
SET
    created_at = TIMESTAMPTZ '2025-11-12 00:00:00+00'
WHERE
    domain IN (
        'bezirksamt-neukoelln.de',
        'charlottenburg-wilmersdorf.de',
        'parlament-berlin.de',
        'berliner-feuerwehr.de',
        'statistik-bbb.de',
        'ts.berlin'
    );

UPDATE public.allowed_email_domains
SET
    created_at = TIMESTAMPTZ '2025-12-04 10:23:53+00'
WHERE
    domain IN (
        'lfg-b.de',
        'senbjf-goeurope.de',
        'aufarbeitung-berlin.de',
        'bebuepol-berlin.de',
        'anlaufstelle-buergerbeteiligung.de',
        'itdz-berlin.de',
        'sfbb.berlin-brandenburg.de',
        'lme.berlin-brandenburg.de',
        'datenschutz-berlin.de'
    );

UPDATE public.allowed_email_domains
SET
    created_at = TIMESTAMPTZ '2026-01-27 11:00:04+00'
WHERE
    domain IN (
        'gdw-berlin.de',
        'bruecke-museum.de',
        'deutschestheater.de',
        'konzerthaus.de',
        'gorki.de',
        'parkaue.de',
        'volksbuehne-berlin.de',
        'krematorium-berlin.de'
    );

-- Create index on is_active for performance
CREATE INDEX IF NOT EXISTS idx_allowed_email_domains_is_active ON public.allowed_email_domains (is_active);

-- Reject wildcard and malformed domains at the data layer (exact-domain format only)
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'allowed_email_domains_exact_format'
	) THEN
		ALTER TABLE public.allowed_email_domains
			ADD CONSTRAINT allowed_email_domains_exact_format
			CHECK (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$');
	END IF;
END;
$$;
