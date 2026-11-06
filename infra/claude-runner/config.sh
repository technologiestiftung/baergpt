# Shared settings for build-golden.sh and runner-loop.sh. Override via environment.
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
# Asana listener (optional): project to watch for "@claude". Empty disables it.
# Token in the keychain: security add-generic-password -a "$USER" -s baergpt-asana-token -w
ASANA_PROJECT_GID="${ASANA_PROJECT_GID:-}"
ASANA_KEYCHAIN_SERVICE="${ASANA_KEYCHAIN_SERVICE:-baergpt-asana-token}"
ASANA_POLL_SECONDS="${ASANA_POLL_SECONDS:-10}"   # 1 Asana request per poll; limit is 1,500/min per token
