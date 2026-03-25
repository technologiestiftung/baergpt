#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Unified Backup Script - Runs backups for all environments
#
# Usage: backup_all.sh
# =============================================================================

SCRIPTS_DIR="${SCRIPTS_DIR:-/home/ubuntu/backup}"
LOG_DIR="$SCRIPTS_DIR/logs"
LOCK_FILE="/var/lock/supabase_backup.lock"
mkdir -p "$LOG_DIR"

TIMESTAMP="$(date -u +%Y-%m-%d_%H%M)"
LOG_FILE="$LOG_DIR/backup_${TIMESTAMP}.log"

# Acquire lock to prevent concurrent runs
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Backup already running"; exit 1; }

# Log to both stdout and file
exec > >(tee -a "$LOG_FILE") 2>&1

echo "============================================="
echo "  UNIFIED SUPABASE BACKUP (prod + staging)"
echo "============================================="
echo "Timestamp: $TIMESTAMP"
echo "Log file:  $LOG_FILE"
echo

# Run prod first
echo ">>> Starting PROD backup..."
"$SCRIPTS_DIR/backup_env.sh" "$SCRIPTS_DIR/configs/prod.env" "$TIMESTAMP"

echo
echo ">>> Starting STAGING backup..."
"$SCRIPTS_DIR/backup_env.sh" "$SCRIPTS_DIR/configs/staging.env" "$TIMESTAMP"

echo
echo "============================================="
echo "  ALL BACKUPS COMPLETE"
echo "============================================="
echo "Log: $LOG_FILE"

