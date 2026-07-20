#!/usr/bin/env bash
set -euo pipefail

# dr-drill.sh — DESTRUCTIVE DR drill for STAGING. Wipes the DB to a bare base
# schema, restores the latest snapshot, and asserts the restore rebuilt the schema
# customizations + data. (Restoring over a live DB would false-pass, so we wipe
# first.) NEVER run against production — guarded to ENV=staging.
#
# Usage:
#   ./dr-drill.sh ./configs/staging.env [SNAPSHOT]           # SNAPSHOT default: latest
#   DRILL_ASSUME_YES=1 ...  # skip the WIPE-staging confirmation prompt

CONFIG_FILE="${1:?Usage: dr-drill.sh /path/to/staging.env [SNAPSHOT]}"
SNAPSHOT="${2:-latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# shellcheck disable=SC1090
source "$CONFIG_FILE"

SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase-baergpt}"
# compose reads the root-owned .env, so it needs sudo (docker exec doesn't).
COMPOSE="sudo docker compose -f docker-compose.yml -f docker-compose.monitoring.yml"

# Safety guards — this script rm -rf's a database.
[[ "${ENV:-}" == "staging" ]] || { echo "❌ refusing: dr-drill is STAGING-ONLY (ENV='${ENV:-}')."; exit 1; }
[[ -n "${SUPABASE_DIR}" ]]    || { echo "❌ SUPABASE_DIR is empty — refusing to rm."; exit 1; }

ssh_exec() { ssh -p "$SSH_PORT" -i "$SSH_KEY" "$SSH_USER@$SERVER_IP" "$@"; }
psql_q()   { ssh_exec "docker exec -i $DB_CONTAINER psql -U postgres -d $DB_NAME -tAc \"$1\"" 2>/dev/null | tr -d '[:space:]'; }
fail()     { echo "❌ DRILL FAIL: $*"; exit 1; }

ssh_exec "test -f '$SUPABASE_DIR/docker-compose.yml'" \
  || fail "$SUPABASE_DIR/docker-compose.yml not found on $SERVER_IP — wrong dir, refusing to wipe."

echo "=== DR DRILL (staging) ==="
echo "Host:     $SSH_USER@$SERVER_IP   dir=$SUPABASE_DIR"
echo "Snapshot: $SNAPSHOT"
echo
echo "⚠️  This DESTROYS staging's database (rm -rf volumes/db/data) and restores it"
echo "    from the snapshot. Staging will be offline during the drill."
echo
if [[ "${DRILL_ASSUME_YES:-0}" != "1" ]]; then
  read -r -p "Type WIPE-staging to continue: " CONFIRM
  [[ "$CONFIRM" == "WIPE-staging" ]] || { echo "Aborted."; exit 1; }
fi

# 1. Wipe to bare — down -v + rm data dir = truly fresh DB (certs in volumes/db/certs are kept).
echo "[1/4] Stopping stack and wiping the database volume..."
ssh_exec "cd '$SUPABASE_DIR' && $COMPOSE down -v"
ssh_exec "sudo rm -rf '$SUPABASE_DIR/volumes/db/data'"
ssh_exec "cd '$SUPABASE_DIR' && $COMPOSE up -d"

# 2. Wait for the base schema, then guard that it is bare (else the drill would false-pass).
echo "[2/4] Waiting for db + gotrue/storage-api to recreate the base schema..."
ready=""
for _ in $(seq 1 60); do
  ready=$(psql_q "SELECT (to_regclass('auth.users') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL)")
  [[ "$ready" == "t" ]] && break
  sleep 5
done
[[ "$ready" == "t" ]] || fail "base schema not ready after ~5min (db/auth/storage didn't come up)."

BARE_POL=$(psql_q "SELECT count(*) FROM pg_policies WHERE schemaname='storage'")
BARE_TRG=$(psql_q "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace fn ON fn.oid=p.pronamespace WHERE NOT t.tgisinternal AND n.nspname='auth' AND fn.nspname NOT IN ('auth','storage','pg_catalog','extensions')")
echo "    bare-check: storage policies=$BARE_POL, app auth triggers=$BARE_TRG (expect 0/0)"
[[ "$BARE_POL" == "0" && "$BARE_TRG" == "0" ]] \
  || fail "DB is not bare before restore — not reproducing the disaster condition."

# 3. Restore (via bash so the restore script's +x bit doesn't matter).
echo "[3/4] Restoring snapshot '$SNAPSHOT'..."
RESTORE_ASSUME_YES=1 bash "$SCRIPT_DIR/restore_env.sh" "$CONFIG_FILE" "$SNAPSHOT" \
  || fail "restore_env.sh failed (its own assertions may have caught an incomplete restore)."

# 4. Structural assertions: bare -> populated.
echo "[4/4] Structural assertions..."
POL=$(psql_q "SELECT count(*) FROM pg_policies WHERE schemaname='storage'")
TRG=$(psql_q "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname='auth'")
RLS=$(psql_q "SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname='objects'")
USERS=$(psql_q "SELECT count(*) FROM auth.users")
OBJS=$(psql_q "SELECT count(*) FROM storage.objects")
BUK=$(psql_q "SELECT count(*) FROM storage.buckets")
echo "    storage policies=$POL  auth triggers=$TRG  storage.objects RLS=$RLS  buckets=$BUK  users=$USERS  objects=$OBJS"
[[ "${POL:-0}"   -gt 0 ]] || fail "no storage policies after restore (capture/restore broken)."
[[ "${TRG:-0}"   -gt 0 ]] || fail "no auth triggers after restore (capture/restore broken)."
[[ "$RLS" == "t" ]]        || fail "RLS not enabled on storage.objects (data-exposure risk)."
[[ "${BUK:-0}"   -gt 0 ]] || fail "no storage buckets after restore (objects orphaned -> 'Bucket not found' 404s)."
[[ "${USERS:-0}" -gt 0 ]] || fail "no users restored."
[[ "${OBJS:-0}"  -gt 0 ]] || fail "no storage objects restored."

echo
echo "✅ DRILL PASS — staging wiped to bare, restored from '$SNAPSHOT', schema customizations + data verified."
echo "   Staging is left running on the restored snapshot."
