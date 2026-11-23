#!/usr/bin/env bash
# Keeps $RUNNER_SLOTS ephemeral runners online. Each slot loops:
#   clone golden VM -> boot -> register a just-in-time runner -> run exactly one job -> delete VM.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

log() { echo "$(date '+%F %T') [$1] ${*:2}"; }

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# Short-lived installation token for the runner GitHub App (no personal token involved).
app_token() {
  local now header payload unsigned sig jwt installation_id
  now="$(date +%s)"
  header="$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)"
  payload="$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' $((now - 60)) $((now + 540)) "$GITHUB_APP_ID" | b64url)"
  unsigned="$header.$payload"
  # Key goes through a pipe, never to disk.
  sig="$(printf '%s' "$unsigned" | openssl dgst -sha256 \
    -sign <(security find-generic-password -s "$KEYCHAIN_SERVICE" -w | base64 -d) | b64url)"
  jwt="$unsigned.$sig"
  installation_id="$(gh_api "$jwt" GET "/orgs/$ORG/installation" | jq -er .id)"
  gh_api "$jwt" POST "/app/installations/$installation_id/access_tokens" | jq -er .token
}

gh_api() {
  local token="$1" method="$2" path="$3"; shift 3
  curl -fsS -X "$method" \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com$path" "$@"
}

jit_config() {
  local name="$1" token labels_json
  token="$(app_token)"
  labels_json="$(jq -cn --arg l "$RUNNER_LABELS" '$l | split(",")')"
  jq -n --arg name "$name" --arg group "$RUNNER_GROUP_ID" --argjson labels "$labels_json" \
    '{name: $name, runner_group_id: ($group | tonumber), labels: $labels, work_folder: "_work"}' \
  | gh_api "$token" POST "/orgs/$ORG/actions/runners/generate-jitconfig" -d @- \
  | jq -er .encoded_jit_config
}

run_slot() {
  local slot="$1"
  while true; do
    local vm="baergpt-runner-$slot-$(date +%s)"
    log "$slot" "cloning $vm"
    if ! tart clone "$GOLDEN_VM" "$vm"; then sleep 30; continue; fi
    tart run --no-graphics $VM_NET_FLAGS "$vm" >/dev/null 2>&1 &
    local tart_pid=$!

    (
      set -e
      ip="$(tart ip --wait 180 "$vm")"
      until ssh $SSH_OPTS -i "$SSH_KEY" "admin@$ip" true 2>/dev/null; do sleep 2; done
      jit="$(jit_config "$vm")"
      log "$slot" "$vm online at $ip, waiting for a job"
      # JIT config goes through stdin so it never shows up in a process list.
      ssh $SSH_OPTS -i "$SSH_KEY" "admin@$ip" \
        'read -r JIT; cd ~/actions-runner && exec ./run.sh --jitconfig "$JIT"' <<<"$jit"
    ) || log "$slot" "$vm exited with error"

    log "$slot" "deleting $vm"
    tart stop "$vm" >/dev/null 2>&1 || true
    wait "$tart_pid" 2>/dev/null || true
    tart delete "$vm" >/dev/null 2>&1 || true
  done
}

# Remove VMs left over from a crash.
tart list --format json | jq -r '.[] | select(.Source=="local") | .Name | select(startswith("baergpt-runner-"))' \
  | while read -r vm; do
      tart stop "$vm" >/dev/null 2>&1 || true
      tart delete "$vm" >/dev/null 2>&1 || true
    done

trap 'kill 0' EXIT INT TERM
for slot in $(seq 1 "$RUNNER_SLOTS"); do run_slot "$slot" & sleep 5; done
wait
