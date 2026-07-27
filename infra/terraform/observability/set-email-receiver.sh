#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# One-time: set the email receiver + route on the instance's Alertmanager config
# (/alertconfigs). Terraform manages the rules; receivers live inside the
# hand-managed instance — see the README for why.
#
# The PUT REPLACES the whole alert config. smarthost must be host:port; `from`
# must be a Brevo-verified sender. Env comes from a 1Password note:
#   set -a; source <(op read "op://<vault>/<note>/notesPlain"); set +a; ./set-email-receiver.sh
# =============================================================================

command -v jq >/dev/null || { echo "jq is required (brew install jq)" >&2; exit 1; }

: "${STACKIT_ACCESS_TOKEN:=$(stackit auth get-access-token)}"
: "${STACKIT_PROJECT_ID:?set STACKIT_PROJECT_ID}"
: "${STACKIT_INSTANCE_ID:?set STACKIT_INSTANCE_ID}"
: "${ALERT_EMAIL_TO:?set ALERT_EMAIL_TO (comma-separated recipients, no spaces)}"
case "$ALERT_EMAIL_TO" in
  *[$'\n\t']*)
    echo "ALERT_EMAIL_TO contains a newline or tab — a wrapped 1Password note is the usual cause." >&2
    exit 1
    ;;
esac
: "${SMTP_SMARTHOST:?set SMTP_SMARTHOST (host:port, e.g. smtp-relay.brevo.com:587)}"
: "${SMTP_FROM:?set SMTP_FROM (Brevo-verified sender)}"
: "${SMTP_USER:?set SMTP_USER}"
: "${SMTP_PASS:?set SMTP_PASS}"
SMTP_AUTH_IDENTITY="${SMTP_AUTH_IDENTITY:-$SMTP_USER}"

API="https://argus.api.eu01.stackit.cloud/v1/projects/${STACKIT_PROJECT_ID}/instances/${STACKIT_INSTANCE_ID}/alertconfigs"
auth=(-H "Authorization: Bearer ${STACKIT_ACCESS_TOKEN}")

echo ">>> Current alert config BEFORE (the PUT below REPLACES this):"
curl -fsS "${auth[@]}" "$API"
echo

read -r -p ">>> Replace the config above with the email receiver? [y/N] " reply
case "$reply" in [yY]*) ;; *) echo "Aborted."; exit 1 ;; esac

# jq (not a heredoc) so quotes/backslashes in SMTP_PASS can't break the JSON.
# One emailConfigs entry per recipient — the API validates `to` as a single address and
# rejects a comma-separated list. groupBy must match the labels the rules set (alerts_*.tf).
PAYLOAD=$(jq -n \
  --arg to "$ALERT_EMAIL_TO" \
  --arg from "$SMTP_FROM" \
  --arg smarthost "$SMTP_SMARTHOST" \
  --arg user "$SMTP_USER" \
  --arg pass "$SMTP_PASS" \
  --arg identity "$SMTP_AUTH_IDENTITY" \
  '{
    receivers: [
      {
        name: "email",
        emailConfigs: (
          $to
          | split(",")
          | map(gsub("^\\s+|\\s+$"; ""))
          | map(select(length > 0))
          | map({
              to: .,
              from: $from,
              smarthost: $smarthost,
              authUsername: $user,
              authPassword: $pass,
              authIdentity: $identity,
              sendResolved: true
            })
        )
      }
    ],
    route: {
      receiver: "email",
      groupBy: ["alertname", "source"],
      groupWait: "30s",
      groupInterval: "5m",
      repeatInterval: "3h"
    }
  }')

echo ">>> PUT ${API}"
# -d @- keeps the SMTP password out of the process table (argv is world-readable).
printf '%s' "$PAYLOAD" |
  curl --fail-with-body -sS -X PUT "$API" "${auth[@]}" -H "Content-Type: application/json" -d @-
echo

echo ">>> Current alert config AFTER (confirm the email receiver landed):"
curl -fsS "${auth[@]}" "$API"
echo
