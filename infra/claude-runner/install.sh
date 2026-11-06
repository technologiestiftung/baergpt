#!/usr/bin/env bash
# Installs the runner loop as a LaunchAgent for the current user.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
LOG_DIR="$HOME/Library/Logs/baergpt-runner"

command -v tart >/dev/null || { echo "Install tart: brew install openai/tools/tart openai/tools/softnet"; exit 1; }
command -v jq >/dev/null || { echo "jq missing (ships with macOS)"; exit 1; }
tart get "$GOLDEN_VM" >/dev/null 2>&1 || { echo "Golden VM missing. Run ./build-golden.sh first."; exit 1; }
[ -n "$GITHUB_APP_ID" ] || { echo "Set GITHUB_APP_ID in config.sh"; exit 1; }
[ -n "$RUNNER_GROUP_ID" ] || { echo "Set RUNNER_GROUP_ID in config.sh"; exit 1; }
security find-generic-password -s "$KEYCHAIN_SERVICE" -w >/dev/null 2>&1 \
  || { echo "App key missing. Run: security add-generic-password -a \"\$USER\" -s $KEYCHAIN_SERVICE -w \"\$(base64 -i app.pem)\""; exit 1; }

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"
# Runner loop (always on) and nightly golden image rebuild check.
for LABEL in berlin.technologiestiftung.baergpt-runner berlin.technologiestiftung.baergpt-runner-rebuild; do
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  sed -e "s#__RUNNER_DIR__#$HERE#g" -e "s#__LOG_DIR__#$LOG_DIR#g" "$HERE/$LABEL.plist" > "$PLIST"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
done
echo "Runner loop started. Logs: tail -f $LOG_DIR/runner.log"
echo "Nightly rebuild check at 03:00. Logs: $LOG_DIR/rebuild.log"
