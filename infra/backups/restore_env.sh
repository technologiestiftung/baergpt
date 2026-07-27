#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Supabase CLI Restore Script
#
# Uses docker exec for restore operations (required for proper permissions).
# Automatically applies auth/storage customizations captured during backup.
#
# Usage:
#   restore_env.sh configs/.staging.env 2026-01-26_1500
#   restore_env.sh configs/.staging.env latest
# =============================================================================

CONFIG_FILE="${1:?Usage: restore_env.sh /path/to/envfile SNAPSHOT}"
SNAPSHOT="${2:?Usage: restore_env.sh /path/to/envfile SNAPSHOT}"

# shellcheck disable=SC1090
source "$CONFIG_FILE"

SNAPSHOT_ROOT="$BACKUP_ROOT/snapshots"

# Resolve "latest" to actual snapshot name
if [[ "$SNAPSHOT" == "latest" ]]; then
  SNAPSHOT="$(
    rclone lsf "$SNAPSHOT_ROOT" --dirs-only \
    | sed 's:/$::' \
    | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{4}$' \
    | sort \
    | tail -n 1
  )"
fi

if [[ -z "$SNAPSHOT" ]]; then
  echo "❌ No snapshot found."
  exit 1
fi

# Verify snapshot exists
if ! rclone lsf "$SNAPSHOT_ROOT/$SNAPSHOT" &>/dev/null; then
  echo "❌ Snapshot '$SNAPSHOT' does not exist."
  exit 1
fi

SNAPSHOT_PATH="$SNAPSHOT_ROOT/$SNAPSHOT"
DB_BACKUP_PATH="$SNAPSHOT_PATH/database.tar.gz.gpg"
FILES_PATH="$SNAPSHOT_PATH/files"

if [[ "$RESTORE_BUCKET" == "$BACKUP_ROOT"* || "$RESTORE_BUCKET" == "$SNAPSHOT_ROOT"* ]]; then
  echo "❌ RESTORE_BUCKET must not point inside BACKUP_ROOT/SNAPSHOT_ROOT"
  exit 1
fi

echo "=== [$ENV] Supabase CLI Restore ==="
echo "Snapshot:  $SNAPSHOT"
echo "Database:  $DB_BACKUP_PATH"
echo "Files:     $FILES_PATH"
echo
echo "⚠️  THIS WILL OVERWRITE:"
echo "   - Bucket: $RESTORE_BUCKET"
echo "   - Database: $DB_NAME"
echo

# non-interactive bypass for dr-drill.sh (RESTORE_ASSUME_YES=1, or --yes/-y)
if [[ "${RESTORE_ASSUME_YES:-0}" == "1" || "${3:-}" == "--yes" || "${3:-}" == "-y" ]]; then
  echo "[$ENV] Confirmation skipped (RESTORE_ASSUME_YES/--yes)."
else
  read -r -p "Type RESTORE-$ENV to continue: " CONFIRM
  if [[ "$CONFIRM" != "RESTORE-$ENV" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

WORK_DIR=$(mktemp -d)

# Cleanup function
cleanup() {
  local exit_code=$?
  rm -rf "$WORK_DIR"
  exit $exit_code
}
trap cleanup EXIT INT TERM

# Helper function to run psql via docker exec
run_psql() {
  ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
    "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME"
}

# -----------------------------------------------------------------------------
# 1. Download and decrypt database backup
# -----------------------------------------------------------------------------
echo
echo "[$ENV][DB] Downloading and decrypting backup..."
rclone cat "$DB_BACKUP_PATH" \
  | gpg --decrypt \
  | tar -xzf - -C "$WORK_DIR"

echo "  Extracted files:"
ls -la "$WORK_DIR"
echo

# We need to truncate, not drop these tables to keep supabases schema structure. 
# -----------------------------------------------------------------------------
# 2. Truncate auth/storage data
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Truncating auth/storage data..."
ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
  "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME" <<'SQL'
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT quote_ident(schemaname)||'.'||quote_ident(tablename) AS tbl
    FROM pg_tables
    WHERE schemaname IN ('auth','storage')
      AND tablename NOT IN ('schema_migrations','migrations')
  ) LOOP
    EXECUTE 'TRUNCATE TABLE '||r.tbl||' CASCADE';
  END LOOP;
END$$;
SQL
echo "  ✓ Auth/storage truncated"

# -----------------------------------------------------------------------------
# 3. Reset public schema
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Resetting public schema..."
ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
  "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME \
   -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'"
echo "  ✓ Public schema reset"

# -----------------------------------------------------------------------------
# 4. Restore roles
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Restoring roles..."
cat "$WORK_DIR/roles.sql" | run_psql
echo "  ✓ Roles restored"

# -----------------------------------------------------------------------------
# 5. Restore schema
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Restoring schema..."
cat "$WORK_DIR/schema.sql" | run_psql
echo "  ✓ Schema restored"

# -----------------------------------------------------------------------------
# 6. Restore data (with triggers disabled)
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Restoring data..."
{
  echo "SET session_replication_role = replica;"
  cat "$WORK_DIR/data.sql"
  echo "SET session_replication_role = DEFAULT;"
} | run_psql
echo "  ✓ Data restored"

# https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore#preserving-migration-history
# -----------------------------------------------------------------------------
# 7. Restore migration history
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Restoring migration history..."
if [[ -s "$WORK_DIR/migrations.sql" ]]; then
  cat "$WORK_DIR/migrations.sql" | run_psql 2>/dev/null || {
    echo "  ⚠ Migration history had warnings (likely duplicates - OK)"
  }
  echo "  ✓ Migration history restored"
else
  echo "  (no migration history to restore)"
fi

# -----------------------------------------------------------------------------
# 8. Apply auth/storage customizations (RLS policies + triggers)
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Applying auth/storage policies + triggers..."
# New backups write auth_storage_objects.sql; older snapshots used auth_storage_changes.sql.
AUTH_STORAGE_FILE=""
for candidate in auth_storage_objects.sql auth_storage_changes.sql; do
  if [[ -s "$WORK_DIR/$candidate" ]]; then AUTH_STORAGE_FILE="$candidate"; break; fi
done
if [[ -n "$AUTH_STORAGE_FILE" ]]; then
  # ON_ERROR_STOP here but not in run_psql: the data restore must tolerate benign SETs
  # like transaction_timeout, but policy/trigger DDL must not half-apply silently.
  cat "$WORK_DIR/$AUTH_STORAGE_FILE" | ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
    "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME -v ON_ERROR_STOP=1" \
    || echo "  ⚠ Some auth/storage statements failed (the assertion below will catch it)"
  echo "  ✓ Applied $AUTH_STORAGE_FILE"

# Assertions to test the restore
  STORAGE_POLICIES=$(ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
    "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME -tAc \
     \"SELECT count(*) FROM pg_policies WHERE schemaname='storage'\"" | tr -d '[:space:]')
  AUTH_TRIGGERS=$(ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
    "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME -tAc \
     \"SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid \
       JOIN pg_namespace n ON n.oid=c.relnamespace \
       WHERE NOT t.tgisinternal AND n.nspname='auth'\"" | tr -d '[:space:]')
  OBJECTS_RLS=$(ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
    "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME -tAc \
     \"SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace \
       WHERE n.nspname='storage' AND c.relname='objects'\"" | tr -d '[:space:]')
  STORAGE_BUCKETS=$(ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
    "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME -tAc \
     \"SELECT count(*) FROM storage.buckets\"" | tr -d '[:space:]')
  echo "  storage policies: ${STORAGE_POLICIES:-?}, auth triggers: ${AUTH_TRIGGERS:-?}, storage.objects RLS: ${OBJECTS_RLS:-?}, storage buckets: ${STORAGE_BUCKETS:-?}"
  if [[ "${STORAGE_POLICIES:-0}" -eq 0 || "${AUTH_TRIGGERS:-0}" -eq 0 || "$OBJECTS_RLS" != "t" || "${STORAGE_BUCKETS:-0}" -eq 0 ]]; then
    echo "❌ Post-restore assertion failed: need storage RLS policies, auth triggers, RLS"
    echo "   enabled on storage.objects (policies without RLS = data exposure, not just 404s),"
    echo "   AND ≥1 storage bucket (no buckets = 'Bucket not found' on every download)."
    echo "   Restore is INCOMPLETE — do not treat this database as recovered."
    exit 1
  fi
else
  echo "  ⚠️  No auth/storage objects in this snapshot (pre-fix backup)."
  echo "      storage RLS policies + auth.users triggers were NOT restored —"
  echo "      re-apply them from the repo migrations before trusting this DB."
fi

# -----------------------------------------------------------------------------
# 12. Restore files
# -----------------------------------------------------------------------------
echo
echo "[$ENV][FILES] Restoring files..."
rclone sync "$FILES_PATH" "$RESTORE_BUCKET" \
  --transfers "$TRANSFERS" --checkers "$CHECKERS" --delete-during
echo "  ✓ Files restored to $RESTORE_BUCKET"

echo
echo "=== [$ENV] Restore complete ==="