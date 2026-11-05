#!/usr/bin/env bash
# Builds the "golden" Tart VM that every runner VM is cloned from.
# Rebuild when .nvmrc, npm, Supabase CLI or Playwright versions change, or monthly for OS patches.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
source "$HERE/config.sh"

BUILD_VM="$GOLDEN_VM-build"
NODE_VERSION="$(tr -d 'v \n' < "$REPO_ROOT/.nvmrc")"
NPM_VERSION="$(node -p "require('$REPO_ROOT/package.json').packageManager.split('@')[1].split('+')[0]")"
PLAYWRIGHT_VERSION="$(node -p "require('$REPO_ROOT/package.json').overrides['playwright-core']")"
SUPABASE_VERSION="$(awk '$1=="supabase-cli"{print $2}' "$REPO_ROOT/.tool-versions")"

# Bun and Claude Code: the versions the pinned claude-code-action would install itself.
ACTION_SHA="$(grep -o 'anthropics/claude-code-action@[0-9a-f]\{40\}' "$REPO_ROOT/.github/workflows/claude.yml" | cut -d@ -f2)"
ACTION_RAW="https://raw.githubusercontent.com/anthropics/claude-code-action/$ACTION_SHA"
ACTION_YML="$(curl -fsSL "$ACTION_RAW/action.yml")"
RUN_TS="$(curl -fsSL "$ACTION_RAW/src/entrypoints/run.ts")"
BUN_VERSION="$(awk '/bun-version:/{print $2}' <<<"$ACTION_YML" | head -n1)"
CLAUDE_CODE_VERSION="$(grep -o 'claudeCodeVersion = "[^"]*"' <<<"$RUN_TS" | head -n1 | cut -d'"' -f2)"
[ -n "$BUN_VERSION" ] && [ -n "$CLAUDE_CODE_VERSION" ] || { echo "Could not read bun/Claude Code versions from action $ACTION_SHA"; exit 1; }

[ -f "$SSH_KEY" ] || { mkdir -p "$(dirname "$SSH_KEY")"; ssh-keygen -q -t ed25519 -N '' -f "$SSH_KEY"; }

cleanup() { tart stop "$BUILD_VM" >/dev/null 2>&1 || true; }
trap cleanup EXIT

tart delete "$BUILD_VM" >/dev/null 2>&1 || true
tart clone "$BASE_IMAGE" "$BUILD_VM"
tart set "$BUILD_VM" --cpu "$VM_CPU" --memory "$VM_MEMORY_MB" --disk-size "$VM_DISK_GB"
tart run --no-graphics "$BUILD_VM" >/dev/null 2>&1 &
IP="$(tart ip --wait 180 "$BUILD_VM")"

# Base image ships with admin/admin. Use it once to install our key, then disable password auth.
ASKPASS="$(mktemp)"; printf '#!/bin/sh\necho admin\n' > "$ASKPASS"; chmod +x "$ASKPASS"
until SSH_ASKPASS="$ASKPASS" SSH_ASKPASS_REQUIRE=force ssh $SSH_OPTS -o PubkeyAuthentication=no "admin@$IP" \
  "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys" < "$SSH_KEY.pub"; do sleep 3; done
rm -f "$ASKPASS"

ssh $SSH_OPTS -i "$SSH_KEY" "admin@$IP" \
  "NODE_VERSION=$NODE_VERSION NPM_VERSION=$NPM_VERSION SUPABASE_VERSION=$SUPABASE_VERSION \
   RUNNER_VERSION=$RUNNER_VERSION PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
   BUN_VERSION=$BUN_VERSION CLAUDE_CODE_VERSION=$CLAUDE_CODE_VERSION WARM_BRANCH=$WARM_BRANCH bash -s" < "$HERE/golden/provision.sh"

ssh $SSH_OPTS -i "$SSH_KEY" "admin@$IP" \
  "echo 'PasswordAuthentication no' | sudo tee /etc/ssh/sshd_config.d/99-no-password.conf >/dev/null \
   && echo 'admin:$(openssl rand -hex 24)' | sudo chpasswd && sudo shutdown -h now" || true

while tart list --format json | jq -e --arg n "$BUILD_VM" '.[] | select(.Name==$n and .State=="running")' >/dev/null; do sleep 2; done

tart delete "$GOLDEN_VM" >/dev/null 2>&1 || true
tart rename "$BUILD_VM" "$GOLDEN_VM"
echo "Golden image ready: $GOLDEN_VM (node $NODE_VERSION, npm $NPM_VERSION, supabase $SUPABASE_VERSION, playwright $PLAYWRIGHT_VERSION, runner $RUNNER_VERSION, bun $BUN_VERSION, claude $CLAUDE_CODE_VERSION)"
