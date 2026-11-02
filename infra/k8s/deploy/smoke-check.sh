#!/usr/bin/env bash
# Checks the backend from outside: /health on its public hostname must return 200 within 120s.
# This goes through DNS, the TLS certificate and the gateway, which the pods' own probes don't.
#
# Inputs: NAMESPACE.
set -euo pipefail

: "${NAMESPACE:?}"
TIMEOUT_SECONDS=120

main() {
  local url waited=0
  url="https://$(public_hostname)/health"
  echo "Checking $url"

  # No --insecure: an invalid certificate fails the check (status 000).
  until [[ "$(status_code "$url")" == "200" ]]; do
    if [[ $waited -ge $TIMEOUT_SECONDS ]]; then
      echo "::error::$url did not return 200 within ${TIMEOUT_SECONDS}s (status 000 with a certificate error above means TLS, not the app)."
      exit 1
    fi
    sleep 5
    waited=$((waited + 5))
  done
  echo "Health check passed."
}

public_hostname() {
  kubectl get httproute backend --namespace "$NAMESPACE" -o jsonpath='{.spec.hostnames[0]}'
}

status_code() {
  local url=$1
  curl -sS -o /dev/null -w '%{http_code}' "$url"
}

main "$@"
