-- Create maintenance_mode table to control application maintenance state
CREATE TABLE maintenance_mode (
	id INT generated always AS (1) stored UNIQUE,
	is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default record with maintenance mode disabled
INSERT INTO
	maintenance_mode (is_enabled)
VALUES
	(FALSE);

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
CREATE TRIGGER trigger_update_maintenance_mode_updated_at before
UPDATE ON maintenance_mode FOR each ROW
EXECUTE function update_maintenance_mode_updated_at ();

comment ON TABLE maintenance_mode IS 'Controls application-wide maintenance mode status';

comment ON COLUMN maintenance_mode.is_enabled IS 'Whether maintenance mode is currently active';

comment ON COLUMN maintenance_mode.updated_at IS 'When this record was last updated';
