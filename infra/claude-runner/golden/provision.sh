#!/usr/bin/env bash
# Runs inside the golden VM (Ubuntu arm64, user "admin") during build-golden.sh.
# Installs everything a job needs so runs start without downloads.
set -euxo pipefail

: "${NODE_VERSION:?}" "${NPM_VERSION:?}" "${SUPABASE_VERSION:?}" "${RUNNER_VERSION:?}" "${PLAYWRIGHT_VERSION:?}"
: "${BUN_VERSION:?}" "${CLAUDE_CODE_VERSION:?}" "${WARM_BRANCH:?}"
export DEBIAN_FRONTEND=noninteractive

sudo apt-get update
sudo apt-get -y upgrade
sudo apt-get install -y --no-install-recommends \
  build-essential ca-certificates curl git gnupg jq unzip zip xz-utils rsync \
  python3 libicu-dev

# Docker (Supabase local stack)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

# GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli.gpg >/dev/null
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/githubcli.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null

# 1Password CLI
curl -fsSL https://downloads.1password.com/linux/keys/1password.asc | sudo gpg --dearmor -o /etc/apt/keyrings/1password.gpg
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/1password.gpg] https://downloads.1password.com/linux/debian/arm64 stable main" \
  | sudo tee /etc/apt/sources.list.d/1password.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin gh 1password-cli
sudo usermod -aG docker admin

# Node into the Actions tool cache, so actions/setup-node finds it offline.
TOOLCACHE=/opt/hostedtoolcache
NODE_DIR="$TOOLCACHE/node/$NODE_VERSION/arm64"
sudo mkdir -p "$NODE_DIR"
curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-arm64.tar.xz" \
  | sudo tar -xJ --strip-components=1 -C "$NODE_DIR"
sudo touch "$NODE_DIR.complete"
sudo chown -R admin:admin "$TOOLCACHE"
echo "export PATH=$NODE_DIR/bin:\$PATH" | sudo tee /etc/profile.d/node.sh >/dev/null
export PATH="$NODE_DIR/bin:$PATH"
npm install -g "npm@$NPM_VERSION"

# Supabase CLI
curl -fsSL "https://github.com/supabase/cli/releases/download/v$SUPABASE_VERSION/supabase_linux_arm64.tar.gz" \
  | sudo tar -xz -C /usr/local/bin supabase

# Playwright system deps + browsers (shared path, reused by every job)
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
sudo mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" && sudo chown admin:admin "$PLAYWRIGHT_BROWSERS_PATH"
sudo env PATH="$PATH" npx -y "playwright@$PLAYWRIGHT_VERSION" install-deps
npx -y "playwright@$PLAYWRIGHT_VERSION" install chromium firefox webkit

# Bun and Claude Code for anthropics/claude-code-action
# (claude.yml passes path_to_bun_executable / path_to_claude_code_executable).
curl -fsSL https://bun.sh/install | bash -s "bun-v$BUN_VERSION"
curl -fsSL https://claude.ai/install.sh | bash -s -- "$CLAUDE_CODE_VERSION"
~/.bun/bin/bun --version
~/.local/bin/claude --version

# GitHub Actions runner (registered per job via --jitconfig)
mkdir -p ~/actions-runner
curl -fsSL "https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-arm64-$RUNNER_VERSION.tar.gz" \
  | tar -xz -C ~/actions-runner
cat > ~/actions-runner/.env <<EOF
RUNNER_TOOL_CACHE=$TOOLCACHE
AGENT_TOOLSDIRECTORY=$TOOLCACHE
PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH
PATH=/home/admin/.local/bin:/home/admin/.bun/bin:$NODE_DIR/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
EOF

# Warm caches from the repo: npm cache and Supabase Docker images.
sudo systemctl start docker
git clone --depth 1 --branch "$WARM_BRANCH" https://github.com/technologiestiftung/baergpt.git /tmp/baergpt
(cd /tmp/baergpt && npm ci --ignore-scripts)
(cd /tmp/baergpt/apps/backend \
  && sudo env PATH="$PATH" SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io supabase start \
       --exclude studio,realtime,imgproxy,edge-runtime,supavisor,postgres-meta \
  && sudo env PATH="$PATH" supabase stop --no-backup)
sudo rm -rf /tmp/baergpt

# Shrink the image.
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/* /tmp/*
sudo fstrim -av || true
