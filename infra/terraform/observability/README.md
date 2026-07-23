# STACKIT Observability alerting (Terraform)

Alert rules for the Supabase VMs' telemetry (host metrics + Kong logs) that the OTel
collector ships to STACKIT Observability (see `infra/supabase/MONITORING.md`).

STACKIT's Grafana is read-only, so alerts live in the Prometheus/Alertmanager layer.
This module manages the alert **rules**. The **receiver** (email, via Brevo) is set
out-of-band by `set-email-receiver.sh`, because receivers live inside the
`observability_instance` — which we keep hand-managed so a bad apply can't replace the
live pipeline. Slack isn't supported by STACKIT's Alertmanager.

## Layout

| File                      | What it manages                                                         |
| ------------------------- | ----------------------------------------------------------------------- |
| `versions.tf`             | Terraform + provider pin; S3 remote-state backend                       |
| `provider.tf`             | `stackit` provider, region `eu01`, env-based auth                       |
| `variables.tf`            | ids, `target_source`, thresholds; validations incl. the workspace guard |
| `alerts_metrics.tf`       | host down / disk / memory / CPU (PromQL)                                |
| `alerts_logs.tf`          | Kong 5xx ratio (LogQL)                                                  |
| `set-email-receiver.sh`   | one-time API call to set the email receiver + route                     |
| `.op.env.observability.*` | 1Password `op://` refs for `op run` auth (real files gitignored)        |
| `*.tfvars.example`        | copy → `staging.tfvars` / `production.tfvars` (gitignored)              |

## Apply

Auth is injected from 1Password via `op run` (like the ansible playbooks); the
`.op.env.observability.<env>` files hold `op://` references only. `project_id`,
`instance_id`, and `target_source` (`supabase-<env>`) come from `<env>.tfvars`.

**Every** terraform command needs the `op run` wrapper, `init` and `workspace` included:
the S3 backend authenticates with `AWS_*` from the env-file and has no metadata-service
fallback, so an unwrapped `init` fails with "No valid credential sources found".

```sh
OP="op run --env-file .op.env.observability.staging --"

$OP terraform init                       # commit the generated .terraform.lock.hcl
$OP terraform workspace select staging   # pick the env's state (see Workspaces)
$OP terraform plan  -var-file=staging.tfvars
$OP terraform apply -var-file=staging.tfvars
```

## Email receiver (one-time, per instance)

Set the receiver + route alerts are delivered to — either in the Portal (Alerting →
Alert config → add an Email receiver named `email` + a route to it), or the script:

```sh
set -a; source <(op read "op://<vault>/<note>/notesPlain"); set +a
./set-email-receiver.sh
```

`smarthost` must be `host:port` (e.g. `smtp-relay.brevo.com:587`); `from` must be a
Brevo-verified sender. Env keys are documented in the script header.

## Remote state

State lives in the `baergpt-tfstate` STACKIT Object Storage bucket (S3 backend in
`versions.tf`). The bucket and its S3 credentials are created by hand; the backend
authenticates with `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from the env-file,
separately from the provider's SA key.

## Workspaces (staging vs production)

Each environment is a named **workspace** — the same config, a separate state file
(`env:/<workspace>/…`); `default` is intentionally empty. A workspace only selects
_which state_; the _values_ come from `-var-file`. Every run sets two dials that must
agree, and `variables.tf` validates `terraform.workspace == var.env` — a mismatched run
fails before it can write to the wrong state.

```sh
OP="op run --env-file .op.env.observability.staging --"

$OP terraform workspace show                 # which env am I in?
$OP terraform workspace select staging       # switch state
$OP terraform apply -var-file=staging.tfvars
```

New env: `$OP terraform workspace new production`, add `production.tfvars` (`env = "production"`),
then apply. `variables.tf` validates that `env` is a known environment and that
`target_source` is `supabase-<env>`, so a typo fails at plan time rather than applying
rules that silently never fire.

## Verify queries before trusting alerts

A rule whose query matches nothing applies cleanly and never fires, so check each
environment in Grafana → Explore before relying on it.

- `count by (source) (system_memory_usage_bytes)` — the environment appears, spelled exactly
  as `target_source`.
- `count by (state) (system_memory_usage_bytes{source="supabase-<env>"})` — `used`, `free`,
  `cached` and `buffered` all present, and their sum ≈ the VM's RAM. A sum above real RAM
  means slab is double-counted and `MemoryHigh` fires late.
- `count by (mode, mountpoint) (system_filesystem_usage_bytes{source="supabase-<env>"})` —
  data mounts are `mode="rw"`. Run the `DiskAlmostFull` ratio itself too: a mount already
  over the threshold fires on apply.
- `{service_name="supabase-<env>"}` on Loki — access lines match `|~ "\" 5\\d\\d "`. The 5xx
  ratio has no series when there are no 5xx, so an empty graph is healthy.

Prove delivery once per instance: add a throwaway `expression = "vector(1)"`, `for = "0s"`
rule, apply, confirm the mail lands, delete, re-apply.

## Gotchas

- **No `up` metric** — metrics are pushed, not scraped, so host-down uses `absent(...)`,
  which fires _because_ nothing matches. Every other rule does the opposite: no matching
  series looks exactly like a healthy one.
- **Receiver name must equal the route's receiver.**
- **Commit `.terraform.lock.hcl`** so everyone uses the same provider version.
- **Editing any rule replaces the whole group** — `rules` forces replacement, so a one-word
  change plans as `1 to add, 1 to destroy` and leaves a sub-second gap in evaluation.
- **A dead logs pipeline is not alerted** — metrics and logs ship independently, so
  `HostOrCollectorDown` can stay silent while the Kong rule goes blind. `absent_over_time`
  would cover it, but not at current traffic, where a quiet hour looks identical to a
  broken pipeline.
- **No state locking** — STACKIT doesn't honor S3 conditional-write locks
  ([stackitcloud/terraform-provider-stackit#1534]), so `use_lockfile` is off. Don't run
  concurrent applies against one workspace.

[stackitcloud/terraform-provider-stackit#1534]: https://github.com/stackitcloud/terraform-provider-stackit/issues/1534
