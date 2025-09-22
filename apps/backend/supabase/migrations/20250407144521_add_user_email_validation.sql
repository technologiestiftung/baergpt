-- Create a trigger function to validate email during INSERT
CREATE OR REPLACE FUNCTION validate_email_on_insert () returns trigger AS $$
BEGIN
    IF NEW.email !~* '^[A-Za-z0-9._%+-]+@(ts\.berlin|([A-Za-z0-9-]+\.)?berlin\.de|itdz-berlin.de)$' THEN
        RAISE EXCEPTION 'Invalid email address: %', NEW.email;
    END IF;
    RETURN NEW;
END;
$$ language plpgsql;

-- Create a trigger that uses the above function before INSERT operations
CREATE TRIGGER trigger_validate_email_before_insert before insert ON auth.users FOR each ROW
EXECUTE function validate_email_on_insert ();
