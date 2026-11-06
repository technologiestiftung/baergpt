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

ASANA_LABEL=berlin.technologiestiftung.baergpt-asana-listener
launchctl bootout "gui/$(id -u)/$ASANA_LABEL" 2>/dev/null || true
if [ -n "$ASANA_PROJECT_GID" ]; then
  security find-generic-password -s "$ASANA_KEYCHAIN_SERVICE" -w >/dev/null 2>&1 \
    || { echo "Asana token missing. Run: security add-generic-password -a \"\$USER\" -s $ASANA_KEYCHAIN_SERVICE -w"; exit 1; }
  NODE_BIN="$(command -v node)" || { echo "node missing"; exit 1; }
  sed -e "s#__RUNNER_DIR__#$HERE#g" -e "s#__LOG_DIR__#$LOG_DIR#g" -e "s#__NODE_BIN__#$NODE_BIN#g" \
    "$HERE/$ASANA_LABEL.plist" > "$HOME/Library/LaunchAgents/$ASANA_LABEL.plist"
  launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/$ASANA_LABEL.plist"
  echo "Asana listener started for project $ASANA_PROJECT_GID. Logs: $LOG_DIR/asana.log"
fi
echo "Runner loop started. Logs: tail -f $LOG_DIR/runner.log"
echo "Nightly rebuild check at 03:00. Logs: $LOG_DIR/rebuild.log"
