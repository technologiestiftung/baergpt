# Shared settings for build-golden.sh and runner-loop.sh. Override via environment, or
# per host (not in git) in ~/.config/baergpt-runner/env, e.g. ASANA_ALLOWED_USERS_OP="op://Vault/Item/field".
# shellcheck disable=SC1091
[ -f "$HOME/.config/baergpt-runner/env" ] && source "$HOME/.config/baergpt-runner/env"
REPO="${REPO:-technologiestiftung/baergpt}"
ORG="${ORG:-${REPO%%/*}}"
# Org runner group limited to the baergpt repo (Org settings → Actions → Runner groups).
RUNNER_GROUP_ID="${RUNNER_GROUP_ID:-4}"
BASE_IMAGE="${BASE_IMAGE:-ghcr.io/cirruslabs/ubuntu:24.04}"
GOLDEN_VM="${GOLDEN_VM:-baergpt-golden}"
WARM_BRANCH="${WARM_BRANCH:-staging}"   # versions, node_modules and Supabase images come from this branch
GOLDEN_MAX_AGE_DAYS="${GOLDEN_MAX_AGE_DAYS:-7}"   # nightly check rebuilds at least this often
RUNNER_VERSION="${RUNNER_VERSION:-2.338.2}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,ARM64,tart,baergpt-claude}"
RUNNER_SLOTS="${RUNNER_SLOTS:-2}"          # VMs kept warm in parallel
VM_CPU="${VM_CPU:-4}"
VM_MEMORY_MB="${VM_MEMORY_MB:-8192}"
VM_DISK_GB="${VM_DISK_GB:-60}"
# Runner VMs: internet only, no host/LAN access. Needs `brew install openai/tools/softnet` with the SUID bit (see README).
VM_NET_FLAGS="${VM_NET_FLAGS:---net-softnet}"
SSH_KEY="${SSH_KEY:-$HOME/.config/baergpt-runner/id_ed25519}"
# GitHub App that registers runners. Only permission: organization "Self-hosted runners: read/write".
# Its private key lives base64-encoded in the macOS keychain:
#   security add-generic-password -a "$USER" -s baergpt-runner-app-key -w "$(base64 -i app.pem)"
GITHUB_APP_ID="${GITHUB_APP_ID:-5593578}"
KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-baergpt-runner-app-key}"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=5"
# Asana listener (optional): comma-separated projects (boards) to watch for "@claude". Empty disables it.
# Token in the keychain: security add-generic-password -a "$USER" -s baergpt-asana-token -w
ASANA_PROJECT_GIDS="${ASANA_PROJECT_GIDS:-}"
ASANA_KEYCHAIN_SERVICE="${ASANA_KEYCHAIN_SERVICE:-baergpt-asana-token}"
ASANA_CONTEXT_KEY_SERVICE="${ASANA_CONTEXT_KEY_SERVICE:-baergpt-asana-context-key}"  # same value as repo secret ASANA_CONTEXT_KEY
# Comma-separated Asana user GIDs allowed to trigger Claude (required; set it in the env file above). Find yours:
#   curl -s -H "Authorization: Bearer $(security find-generic-password -s baergpt-asana-token -w)" \
#     https://app.asana.com/api/1.0/users/me | jq -r .data.gid
ASANA_ALLOWED_USERS="${ASANA_ALLOWED_USERS:-}"
# Instead of the two values above: 1Password references. install.sh reads them with `op read`
# (Touch ID, so run it at the Mac) and hands the values to the listener.
ASANA_PROJECT_GIDS_OP="${ASANA_PROJECT_GIDS_OP:-}"
ASANA_ALLOWED_USERS_OP="${ASANA_ALLOWED_USERS_OP:-}"
ASANA_POLL_SECONDS="${ASANA_POLL_SECONDS:-10}"   # 1 Asana request per poll; limit is 1,500/min per token
