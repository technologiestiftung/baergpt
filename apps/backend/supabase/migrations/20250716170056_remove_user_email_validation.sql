-- Drop the trigger that validates email before INSERT operations
DROP TRIGGER if EXISTS trigger_validate_email_before_insert ON auth.users;

-- Drop the function that validates email addresses
DROP FUNCTION if EXISTS validate_email_on_insert ();
