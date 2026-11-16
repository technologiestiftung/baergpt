#!/usr/bin/env bash
# Writes an environment's env from its 1Password note into the app Secrets and reports which
# Secret each Deployment should use (GitHub step outputs `backend` and `gotenberg`).
#
# Each app has two Secrets, <app>-env-a and <app>-env-b. A changed env goes into the one not
# in use, so the other keeps the previous env and `kubectl rollout undo` restores code and env
# together. An unchanged env keeps the Secret in use, so the pods don't restart.
#
# Inputs: NAMESPACE, ENV_NOTE_REF (op:// reference to the note), and OP_SERVICE_ACCOUNT_TOKEN
# or a signed-in `op`. Outputs go to $GITHUB_OUTPUT, or to stdout when run locally.
set -euo pipefail

: "${NAMESPACE:?}" "${ENV_NOTE_REF:?}"

main() {
  work_dir=$(make_private_dir)
  trap 'rm -rf "$work_dir"' EXIT

  op read "$ENV_NOTE_REF" > "$work_dir/note.env"
  split_note "$work_dir/note.env" "$work_dir/backend.env" "$work_dir/gotenberg.env"

  sync_app backend "$work_dir/backend.env"
  # Sandbox uses staging's Gotenberg.
  if [[ "$NAMESPACE" != "sandbox" ]]; then
    sync_app gotenberg "$work_dir/gotenberg.env"
  fi
}

# The backend gets every variable except the Cloud Foundry sizing keys in the same note.
# Gotenberg only reads its basic-auth credentials. The note is read again on every deploy,
# so a variable removed from it disappears from the Secret too.
split_note() {
  local note=$1 backend_env=$2 gotenberg_env=$3
  local line key value
  : > "$backend_env"
  : > "$gotenberg_env"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'} # tolerate a CRLF-edited note
    if is_blank_or_comment "$line"; then
      continue
    fi
    key=${line%%=*}   # before the first "="
    value=${line#*=}  # after the first "="
    hide_in_github_logs "$value"

    case "$key" in
      CF_* | GOTENBERG_MEMORY) continue ;;
    esac
    echo "$key=$value" >> "$backend_env"
    if [[ "$key" == GOTENBERG_API_BASIC_AUTH_* ]]; then
      echo "$key=$value" >> "$gotenberg_env"
    fi
  done < "$note"
}

sync_app() {
  local app=$1 env_file=$2
  local in_use spare
  in_use=$(secret_in_use "$app")

  if is_ab_secret "$app" "$in_use" &&
    [[ "$(fingerprint_of_secret "$in_use")" == "$(fingerprint_of_file "$env_file")" ]]; then
    echo "$app: env unchanged, keeping $in_use"
    set_output "$app" "$in_use"
    return
  fi

  spare=$(spare_secret "$app" "$in_use")
  echo "$app: writing env to $spare"
  write_secret "$spare" "$env_file"
  set_output "$app" "$spare"
}

# The Secret the app's Deployment reads its env from. Empty if there is no Deployment yet.
secret_in_use() {
  local app=$1
  kubectl get deployment "$app" --namespace "$NAMESPACE" --ignore-not-found \
    -o jsonpath="{.spec.template.spec.containers[?(@.name==\"$app\")].envFrom[0].secretRef.name}"
}

is_ab_secret() {
  local app=$1 secret=$2
  [[ "$secret" == "$app-env-a" || "$secret" == "$app-env-b" ]]
}

# The A/B Secret not in use. Before the first A/B deploy (old name or no Deployment), that's -a.
spare_secret() {
  local app=$1 in_use=$2
  if [[ "$in_use" == "$app-env-a" ]]; then
    echo "$app-env-b"
  else
    echo "$app-env-a"
  fi
}

# Writes the env file into the Secret and tags it with the file's fingerprint.
write_secret() {
  local secret=$1 env_file=$2
  kubectl create secret generic "$secret" --namespace "$NAMESPACE" \
    --from-env-file="$env_file" --dry-run=client -o yaml |
    kubectl annotate --local -f - "env-sha256=$(fingerprint_of_file "$env_file")" -o yaml |
    kubectl apply -f -
}

# Empty if the Secret doesn't exist or has no fingerprint.
fingerprint_of_secret() {
  local secret=$1
  kubectl get secret "$secret" --namespace "$NAMESPACE" --ignore-not-found \
    -o jsonpath='{.metadata.annotations.env-sha256}'
}

fingerprint_of_file() {
  local file=$1
  shasum -a 256 "$file" | cut -d' ' -f1
}

is_blank_or_comment() {
  local line=$1
  [[ -z "$line" || "$line" == \#* ]]
}

# GitHub replaces the value with *** in all later log output. Locally there's nothing to hide.
hide_in_github_logs() {
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "::add-mask::$1"
  fi
}

set_output() {
  local name=$1 value=$2
  echo "$name=$value" >> "${GITHUB_OUTPUT:-/dev/stdout}"
}

# Outside the repo checkout; mktemp makes it readable only by us.
make_private_dir() {
  mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/env.XXXXXX"
}

main "$@"
