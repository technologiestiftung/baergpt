#!/usr/bin/env bash
# Waits until every Deployment that render-and-apply.sh applied has rolled out.
# Fails if one isn't ready within ROLLOUT_TIMEOUT (default 5m). Until then, the previous
# ReplicaSet keeps serving.
#
# Inputs: NAMESPACE, optional ROLLOUT_TIMEOUT. Reads deployments.txt from the current directory.
set -euo pipefail

: "${NAMESPACE:?}"
ROLLOUT_TIMEOUT=${ROLLOUT_TIMEOUT:-5m}

main() {
  local deployment
  while IFS= read -r deployment || [[ -n "$deployment" ]]; do
    if [[ -z "$deployment" ]]; then
      continue
    fi
    echo "Waiting for ${deployment}…"
    kubectl rollout status "$deployment" --namespace "$NAMESPACE" --timeout="$ROLLOUT_TIMEOUT"
  done < deployments.txt
}

main "$@"
