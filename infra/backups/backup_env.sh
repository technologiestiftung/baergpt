#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Supabase CLI Backup Script
# 
# Uses official supabase db dump commands for proper backup handling.
# Captures auth/storage customizations automatically via supabase db diff.
#
# Usage:
#   backup_env.sh configs/staging.env
#   backup_env.sh configs/staging.env 2026-01-26_1500
# =============================================================================

CONFIG_FILE="${1:?Usage: backup_env.sh /path/to/envfile [TIMESTAMP]}"
TIMESTAMP="${2:-$(date -u +%Y-%m-%d_%H%M)}"

# shellcheck disable=SC1090
source "$CONFIG_FILE"

SNAPSHOT_ROOT="$BACKUP_ROOT/snapshots"
SNAPSHOT_PATH="$SNAPSHOT_ROOT/$TIMESTAMP"
WORK_DIR=$(mktemp -d)

# -----------------------------------------------------------------------------
# Disk usage logging helpers
# -----------------------------------------------------------------------------
# These are here to keep an eye on disk usage since the Supabase CLI does not directly 
# pipe our backups to the cloud but we need to hold them on the disk momentarily. 
log_disk_avail() {
  df -h "$WORK_DIR" --output=avail 2>/dev/null | tail -1 | xargs || echo "N/A"
}

log_file_size() {
  local file="$1"
  if [[ -f "$file" ]]; then
    du -h "$file" | cut -f1
  else
    echo "N/A"
  fi
}

log_dir_size() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    du -sh "$dir" 2>/dev/null | cut -f1 || echo "N/A"
  else
    echo "N/A"
  fi
}

# Cleanup function
cleanup() {
  local exit_code=$?
  # Kill SSH tunnel if running
  if [[ -n "${TUNNEL_PID:-}" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  # Remove temp directory
  rm -rf "$WORK_DIR"
  exit $exit_code
}
trap cleanup EXIT INT TERM

# Build connection string for local tunnel
DB_URL="postgresql://$DB_USER:$DB_PASSWORD@127.0.0.1:$LOCAL_DB_PORT/$DB_NAME"

echo "=== [$ENV] Supabase CLI Backup ==="
echo "Timestamp: $TIMESTAMP"
echo "Backup root: $BACKUP_ROOT"
echo "Work dir: $WORK_DIR"
echo "Disk available: $(log_disk_avail)"
echo

# -----------------------------------------------------------------------------
# 1. Create SSH tunnel to database
# -----------------------------------------------------------------------------
echo "[$ENV] Opening SSH tunnel to database..."

# Get container IP dynamically (container names aren't resolvable from host)
DB_CONTAINER_IP=$(ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" \
  "docker inspect $DB_CONTAINER --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'")
echo "  Container IP: $DB_CONTAINER_IP"

if [[ -z "$DB_CONTAINER_IP" ]]; then
  echo "❌ Failed to resolve container IP for $DB_CONTAINER"
  exit 1
fi

ssh -f -N -L "$LOCAL_DB_PORT:$DB_CONTAINER_IP:5432" \
  -o StrictHostKeyChecking=accept-new \
  -o ServerAliveInterval=60 \
  -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP"

# Find the tunnel PID
sleep 1
TUNNEL_PID=$(pgrep -f "ssh.*-L.*$LOCAL_DB_PORT:$DB_CONTAINER_IP:5432.*$SERVER_IP" | head -n1)
echo "  Tunnel PID: $TUNNEL_PID"
sleep 2  # Wait for tunnel to establish

# Verify connection
if ! psql "$DB_URL" -c "SELECT 1" &>/dev/null; then
  echo "❌ Failed to connect to database via tunnel"
  exit 1
fi
echo "  Connected successfully"
echo

# -----------------------------------------------------------------------------
# 2. Dump roles (custom roles with login)
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Dumping roles..."
supabase db dump --db-url "$DB_URL" -f "$WORK_DIR/roles.sql" --role-only
echo "  $(wc -l < "$WORK_DIR/roles.sql") lines, $(log_file_size "$WORK_DIR/roles.sql")"

# -----------------------------------------------------------------------------
# 3. Dump schema (tables, functions, triggers, indexes, constraints)
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Dumping schema..."
supabase db dump --db-url "$DB_URL" -f "$WORK_DIR/schema.sql"
echo "  $(wc -l < "$WORK_DIR/schema.sql") lines, $(log_file_size "$WORK_DIR/schema.sql")"

# -----------------------------------------------------------------------------
# 4. Dump data
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Dumping data..."
supabase db dump --db-url "$DB_URL" -f "$WORK_DIR/data.sql" --use-copy --data-only
echo "  $(wc -l < "$WORK_DIR/data.sql") lines, $(log_file_size "$WORK_DIR/data.sql")"

# -----------------------------------------------------------------------------
# 5. Capture auth/storage customizations (triggers, RLS policies, etc.)
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Capturing auth/storage customizations..."
supabase db diff --db-url "$DB_URL" --schema auth,storage \
  > "$WORK_DIR/auth_storage_changes.sql" 2>/dev/null || touch "$WORK_DIR/auth_storage_changes.sql"
if [[ -s "$WORK_DIR/auth_storage_changes.sql" ]]; then
  echo "  $(wc -l < "$WORK_DIR/auth_storage_changes.sql") lines, $(log_file_size "$WORK_DIR/auth_storage_changes.sql")"
else
  echo "  No customizations found"
fi

# -----------------------------------------------------------------------------
# 6. Dump migration history (preserves Supabase CLI migration state)
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Dumping migration history..."
supabase db dump --db-url "$DB_URL" -f "$WORK_DIR/migrations.sql" \
  --schema supabase_migrations 2>/dev/null || touch "$WORK_DIR/migrations.sql"
echo "  $(wc -l < "$WORK_DIR/migrations.sql") lines, $(log_file_size "$WORK_DIR/migrations.sql")"

# -----------------------------------------------------------------------------
# 7. Encrypt and upload database backup
# -----------------------------------------------------------------------------
echo "[$ENV][DB] Total dump size (uncompressed): $(log_dir_size "$WORK_DIR")"
echo "[$ENV][DB] Disk available before upload: $(log_disk_avail)"
echo "[$ENV][DB] Encrypting and uploading..."
tar -C "$WORK_DIR" -czf - . \
  | gpg --batch --yes --encrypt --recipient "$GPG_RECIPIENT" --trust-model always \
  | rclone rcat "$SNAPSHOT_PATH/database.tar.gz.gpg" --s3-chunk-size 100M
echo "  Uploaded to: $SNAPSHOT_PATH/database.tar.gz.gpg"

# Get remote file size
REMOTE_SIZE_JSON=$(rclone size "$SNAPSHOT_PATH/database.tar.gz.gpg" --json 2>/dev/null || echo '{}')
REMOTE_BYTES=$(echo "$REMOTE_SIZE_JSON" | grep -o '"bytes":[0-9]*' | cut -d: -f2 || echo "")
if [[ -n "$REMOTE_BYTES" && "$REMOTE_BYTES" -gt 0 ]]; then
  echo "  Compressed size: $(numfmt --to=iec-i --suffix=B "$REMOTE_BYTES" 2>/dev/null || echo "${REMOTE_BYTES} bytes")"
fi
echo

# -----------------------------------------------------------------------------
# 8. Sync storage files
# -----------------------------------------------------------------------------
echo "[$ENV][FILES] Syncing live -> mirror..."
rclone sync "$SOURCE_BUCKET" "$SNAPSHOT_ROOT/current_mirror" \
  --transfers "$TRANSFERS" --checkers "$CHECKERS" --delete-during

echo "[$ENV][FILES] Copying mirror -> snapshot..."
rclone copy "$SNAPSHOT_ROOT/current_mirror" "$SNAPSHOT_PATH/files" \
  --transfers "$TRANSFERS" --checkers "$CHECKERS"
echo

# -----------------------------------------------------------------------------
# 9. Prune old snapshots
# -----------------------------------------------------------------------------
echo "[$ENV] Pruning snapshots older than ${RETENTION_DAYS}d..."
CUTOFF_DATE="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%d_%H%M)"
echo "  Cutoff: $CUTOFF_DATE"

rclone lsf "$SNAPSHOT_ROOT" --dirs-only \
  | sed 's:/$::' \
  | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{4}$' \
  | while read -r SNAP; do
      if [[ "$SNAP" < "$CUTOFF_DATE" ]]; then
        echo "  Deleting old snapshot: $SNAP"
        rclone purge "$SNAPSHOT_ROOT/$SNAP"
      fi
    done

# -----------------------------------------------------------------------------
# 10. Final summary
# -----------------------------------------------------------------------------
echo "[$ENV] Backup size summary:"
SNAPSHOT_SIZE_JSON=$(rclone size "$SNAPSHOT_PATH" --json 2>/dev/null || echo '{}')
SNAPSHOT_BYTES=$(echo "$SNAPSHOT_SIZE_JSON" | grep -o '"bytes":[0-9]*' | cut -d: -f2 || echo "")
SNAPSHOT_COUNT=$(echo "$SNAPSHOT_SIZE_JSON" | grep -o '"count":[0-9]*' | cut -d: -f2 || echo "")
if [[ -n "$SNAPSHOT_BYTES" && "$SNAPSHOT_BYTES" -gt 0 ]]; then
  echo "  Snapshot total: $(numfmt --to=iec-i --suffix=B "$SNAPSHOT_BYTES" 2>/dev/null || echo "${SNAPSHOT_BYTES} bytes") (${SNAPSHOT_COUNT:-?} files)"
fi
echo "  Disk available after cleanup: $(log_disk_avail)"

echo
echo "=== [$ENV] Backup complete ==="
echo "Restore point: $SNAPSHOT_PATH"

