#!/usr/bin/env bash
# Run nightly by launchd. Rebuilds the golden image if its inputs changed on $WARM_BRANCH
# or it is older than $GOLDEN_MAX_AGE_DAYS (OS and package security updates).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
source "$HERE/lib.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

log() { echo "$(date '+%F %T') $*"; }

current="$(fingerprint)"
previous="$(cat "$FINGERPRINT_FILE" 2>/dev/null || true)"
age_days=999
[ -f "$FINGERPRINT_FILE" ] && age_days=$(( ($(date +%s) - $(stat -f %m "$FINGERPRINT_FILE")) / 86400 ))

if [ "$current" = "$previous" ] && [ "$age_days" -lt "$GOLDEN_MAX_AGE_DAYS" ]; then
  log "Golden image up to date (${age_days}d old)"
  exit 0
fi

log "Rebuilding golden image (inputs changed: $([ "$current" != "$previous" ] && echo yes || echo no), age: ${age_days}d)"
"$HERE/build-golden.sh"
log "Rebuild done"
