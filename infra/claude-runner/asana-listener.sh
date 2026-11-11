#!/usr/bin/env bash
# LaunchAgent entry point: loads config.sh and starts the Asana listener with Node.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
export REPO ORG GITHUB_APP_ID KEYCHAIN_SERVICE ASANA_PROJECT_GIDS ASANA_KEYCHAIN_SERVICE ASANA_CONTEXT_KEY_SERVICE ASANA_POLL_SECONDS ASANA_ALLOWED_USERS ASANA_WORKFLOW ASANA_WORKFLOW_REF
exec "${NODE_BIN:-node}" "$HERE/asana-listener.mts"
