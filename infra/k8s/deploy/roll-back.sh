#!/usr/bin/env bash
# Rolls back the Deployments this deploy changed, to the revision they had before it.
#
# Plain `kubectl rollout undo` goes one revision back even if this deploy created none, which
# would downgrade a Deployment it never touched. Each revision's pod template names its env
# Secret (<app>-env-a/-b), so going back restores the previous env as well.
#
# Inputs: NAMESPACE. Reads deployments.txt and revisions-before.txt from the current directory
# (written by render-and-apply.sh).
#
# No `set -e`: a failed undo of one Deployment must not skip the others.
set -uo pipefail

: "${NAMESPACE:?}"

main() {
  local deployment before now
  while IFS= read -r deployment || [[ -n "$deployment" ]]; do
    if [[ -z "$deployment" ]]; then
      continue
    fi
    before=$(revision_before "$deployment")
    now=$(current_revision "$deployment")

    if [[ -z "$before" ]]; then
      echo "$deployment is new: nothing to roll back to"
    elif [[ "$now" == "$before" ]]; then
      echo "$deployment: unchanged by this run, left as is"
    else
      echo "Rolling back $deployment to revision $before"
      kubectl rollout undo "$deployment" --namespace "$NAMESPACE" --to-revision="$before" || true
    fi
  done < deployments.txt
}

# Empty if the Deployment didn't exist before this deploy.
revision_before() {
  local deployment=$1
  awk -v d="$deployment" '$1 == d { print $2 }' revisions-before.txt
}

current_revision() {
  local deployment=$1
  kubectl get "$deployment" --namespace "$NAMESPACE" \
    -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}'
}

main "$@"
