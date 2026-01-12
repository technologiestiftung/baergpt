-- Create a function to validate email against allowed_email_domains table
CREATE OR REPLACE FUNCTION public.validate_email_domain () returns trigger language plpgsql security definer
SET
    search_path = '' AS $$
DECLARE
    email_domain TEXT;
    domain_pattern TEXT;
    is_valid BOOLEAN := FALSE;
BEGIN
    -- Check if email contains @ symbol
    IF NEW.email NOT LIKE '%@%' THEN
        RAISE EXCEPTION 'Invalid email format: missing @ symbol';
    END IF;
    -- Extract domain from email (everything after @)
    email_domain := lower(split_part(NEW.email, '@', 2));
    
    -- Check if domain is empty
    IF email_domain IS NULL OR email_domain = '' THEN
        RAISE EXCEPTION 'Invalid email format: missing domain';
    END IF;
    
    -- Check against each allowed domain pattern
    FOR domain_pattern IN SELECT domain FROM public.allowed_email_domains LOOP
        -- Handle wildcard patterns (*.domain.tld)
        IF domain_pattern LIKE '*%' THEN
            -- Remove the leading '*.' to get the base domain
            DECLARE
                base_domain TEXT := lower(substring(domain_pattern from 3));
            BEGIN
                -- Check if email_domain ends with .base_domain (subdomain required)
                -- e.g., for *.berlin.de: foo.berlin.de matches, berlin.de does NOT match
                IF email_domain ~ ('^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.' || regexp_replace(base_domain, '([.\\^$|*+?(){}\[\]])', '\\\1', 'g') || '$') THEN
                    is_valid := TRUE;
                    EXIT;
                END IF;
            END;
        ELSE
            -- Exact domain match (case-insensitive)
            IF email_domain = lower(domain_pattern) THEN
                is_valid := TRUE;
                EXIT;
            END IF;
        END IF;
    END LOOP;
    
    IF NOT is_valid THEN
        RAISE EXCEPTION 'Email domain "%" is not in the list of allowed domains', email_domain
            USING HINT = 'Contact your administrator if you believe this domain should be allowed.';
    END IF;
    
    RETURN NEW;
END;
$$;

comment ON function public.validate_email_domain () IS 'Validates that new user emails have domains in the allowed_email_domains table. Supports wildcards (*.domain.tld) and exact matches.';

-- Create a trigger that validates email BEFORE INSERT on auth.users
CREATE OR REPLACE TRIGGER trigger_validate_email_domain_before_insert_auth_users before insert ON auth.users FOR each ROW
EXECUTE function public.validate_email_domain ();

-- Also validate on UPDATE in case email is changed
CREATE OR REPLACE TRIGGER trigger_validate_email_domain_on_update_auth_users before
UPDATE of email ON auth.users FOR each ROW WHEN (old.email IS DISTINCT FROM new.email)
EXECUTE function public.validate_email_domain ();
