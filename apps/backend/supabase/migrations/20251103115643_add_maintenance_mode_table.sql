-- Create maintenance_mode table to control application maintenance state
CREATE TABLE maintenance_mode (
    onerow_id BOOL PRIMARY KEY DEFAULT TRUE CONSTRAINT onerow_uni CHECK (onerow_id),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent deletion of records from maintenance_mode table
CREATE OR REPLACE FUNCTION prevent_maintenance_mode_delete () returns trigger AS $$
BEGIN
    RAISE EXCEPTION 'Deleting from maintenance_mode table is not allowed';
END;
$$ language plpgsql security definer
SET
    search_path = '';

CREATE TRIGGER trigger_prevent_maintenance_mode_delete
BEFORE DELETE ON maintenance_mode FOR EACH ROW
EXECUTE FUNCTION prevent_maintenance_mode_delete ();

-- Prevent truncation of maintenance_mode table
CREATE OR REPLACE FUNCTION prevent_maintenance_mode_truncate () returns trigger AS $$
BEGIN
    RAISE EXCEPTION 'Truncating maintenance_mode table is not allowed';
END;
$$ language plpgsql security definer
SET
    search_path = '';

CREATE TRIGGER trigger_prevent_maintenance_mode_truncate
BEFORE TRUNCATE ON maintenance_mode
EXECUTE FUNCTION prevent_maintenance_mode_truncate ();

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_maintenance_mode_updated_at () returns trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql security definer
SET
    search_path = '';

-- Create trigger to automatically update updated_at on record changes
CREATE TRIGGER trigger_update_maintenance_mode_updated_at
BEFORE UPDATE ON maintenance_mode FOR EACH ROW
EXECUTE FUNCTION update_maintenance_mode_updated_at ();

COMMENT ON TABLE maintenance_mode IS 'Controls application-wide maintenance mode status';

COMMENT ON COLUMN maintenance_mode.is_enabled IS 'Whether maintenance mode is currently active';

COMMENT ON COLUMN maintenance_mode.updated_at IS 'When this record was last updated';
