#!/usr/bin/env bash
# Renders an environment's overlay with this deploy's image and env Secrets, and applies it.
#
# The overlay is wrapped in a temporary kustomization, so the checked-out files stay unchanged.
# Before applying, it records each Deployment's revision, so roll-back.sh can undo exactly what
# this deploy changed.
#
# Inputs: NAMESPACE, OVERLAY (path to infra/k8s/overlays/<namespace>), IMAGE_NAME, DIGEST,
# BACKEND_SECRET, and GOTENBERG_SECRET (empty where the overlay has no Gotenberg).
# Writes to the current directory, for wait-for-rollout.sh and roll-back.sh:
#   rendered.yaml, applied.txt, deployments.txt, revisions-before.txt
set -euo pipefail

: "${NAMESPACE:?}" "${OVERLAY:?}" "${IMAGE_NAME:?}" "${DIGEST:?}" "${BACKEND_SECRET:?}"
GOTENBERG_SECRET=${GOTENBERG_SECRET:-}

main() {
  kustomize_dir=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/render.XXXXXX")
  trap 'rm -rf "$kustomize_dir"' EXIT

  write_kustomization "$kustomize_dir"
  kubectl kustomize "$kustomize_dir" > rendered.yaml

  record_revisions > revisions-before.txt
  kubectl apply -f rendered.yaml -o name | tee applied.txt

  # The Deployments this overlay applied, in the form `kubectl rollout` takes.
  grep '^deployment' applied.txt > deployments.txt || true
  if [[ ! -s deployments.txt ]]; then
    echo "::error::No Deployments found in the applied manifests — refusing to continue."
    exit 1
  fi
}

write_kustomization() {
  local dir=$1
  cat > "$dir/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - $(relative_path "$dir" "$OVERLAY")
images:
  - name: $IMAGE_NAME
    digest: $DIGEST
patches:
EOF
  use_env_secret backend "$BACKEND_SECRET" >> "$dir/kustomization.yaml"
  if [[ -n "$GOTENBERG_SECRET" ]]; then
    use_env_secret gotenberg "$GOTENBERG_SECRET" >> "$dir/kustomization.yaml"
  fi
}

# A patch that points the app's Deployment at the given env Secret. The `test` fails the
# render if the base no longer has the placeholder <app>-env in that place.
use_env_secret() {
  local app=$1 secret=$2
  cat <<EOF
  - target: {kind: Deployment, name: $app}
    patch: |-
      - op: test
        path: /spec/template/spec/containers/0/envFrom/0/secretRef/name
        value: $app-env
      - op: replace
        path: /spec/template/spec/containers/0/envFrom/0/secretRef/name
        value: $secret
EOF
}

# One line per existing Deployment: "deployment.apps/<name> <revision>".
record_revisions() {
  kubectl get deployments --namespace "$NAMESPACE" \
    -o jsonpath='{range .items[*]}deployment.apps/{.metadata.name} {.metadata.annotations.deployment\.kubernetes\.io/revision}{"\n"}{end}'
}

# Kustomize only accepts relative paths to other kustomizations, and resolves symlinks before
# following them (on macOS, $TMPDIR is under /var, a symlink to /private/var), so both ends are
# resolved first.
relative_path() {
  local from=$1 to=$2
  python3 -c 'import os, sys; print(os.path.relpath(os.path.realpath(sys.argv[2]), os.path.realpath(sys.argv[1])))' "$from" "$to"
}

main "$@"
