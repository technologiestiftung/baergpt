# STACKIT Cloud Foundry environments (Terraform)

Provisions one CF org (`baergpt`) with `staging` and `prod` spaces in the
`baergpt-berlin-prod` STACKIT project.

## Layout

| File                  | Manages                                                              |
| --------------------- | -------------------------------------------------------------------- |
| `versions.tf`         | Terraform + provider pins; S3 remote-state backend                   |
| `provider.tf`         | `stackit` + `cloudfoundry` providers (CF wired from the org-manager) |
| `variables.tf`        | project id, org name, region, operators, per-space quota + ssh       |
| `org.tf`              | CF org + technical org-manager + platform data source                |
| `spaces.tf`           | spaces, space quotas, org/space roles                                |
| `service-accounts.tf` | per-space CI service accounts + their keys                           |
| `autoscaler.tf`       | per-space App-Autoscaler service instance (`<space>-autoscaler`)     |
| `outputs.tf`          | api_url, CI credentials                                              |

## Quotas

`var.quota_id` is the org-wide plan ("Kontingent"); `var.spaces` subdivides it. The org
quota always binds, so raising a space beyond it silently does nothing.

The portal shows plan names but not their ids, and the `stackit` CLI has no SCF commands.
`quota_id` is the CF org-quota GUID:

```sh
cf curl /v3/organization_quotas | jq '.resources[] | {name, guid, memory_mb: .apps.total_memory_in_mb}'
```

Switch plans in the portal, then update `quota_id` to match.

## Autoscaling

`autoscaler.tf` provisions **one App-Autoscaler service instance per space**
(`<space>-autoscaler`, e.g. `staging-autoscaler`, `prod-autoscaler`) from the free
`autoscaler-free-plan` in the STACKIT marketplace. This is deliberately split from the
scaling policy:

- **The service instance** is the durable half — provisioned once by Terraform, it lives
  independently of any app deploy. One instance is shared by every app in the space.
- **The policy** (min/max instances + scaling rules) is _not_ in Terraform. The apps
  themselves are created by `cf push` in CI, not here, so each deploy workflow attaches a
  committed policy JSON to its app by binding it to the space's autoscaler instance. See
  `autoscaler-policy-*.json` and the "Attach autoscaling policy" step in
  `backend-deploy-stackit-cf.yml` / `gotenberg-deploy-stackit-cf.yml`.

Because the plan is free, `allow_paid_service_plans` stays `false` on the space quota.

## Auth

Auth is injected from 1Password via `op run`, like the observability module. The
`.op.env.cloud-foundry` file holds `op://` references only.

```sh
cp terraform.tfvars.example terraform.tfvars              # fill in project_id + operators
cp .op.env.cloud-foundry.example .op.env.cloud-foundry   # point op:// refs at your 1Password items

OP="op run --env-file .op.env.cloud-foundry --"
```

> **State is sensitive.** Application secrets (Supabase/Mistral keys) are set via
> `cf set-env` and never touch Terraform, but the auto-generated org-manager password
> _is_ persisted in state because the CF provider authenticates from it. Treat the
> remote state (STACKIT Object Storage) as a secret store.

## Apply

The CF provider is configured from the org-manager's password, which is unknown until
that resource exists. So the **first** apply bootstraps the org-manager, then applies
the rest:

```sh
$OP terraform init
$OP terraform apply -target=stackit_scf_organization_manager.manager
$OP terraform apply
```

Every later change is a plain `$OP terraform apply` — no `-target`.

> **No state locking.** STACKIT doesn't honor S3 conditional-write locks
> ([stackitcloud/terraform-provider-stackit#1534]), so `use_lockfile` is off. Don't run
> concurrent applies against this state.

[stackitcloud/terraform-provider-stackit#1534]: https://github.com/stackitcloud/terraform-provider-stackit/issues/1534

## CI credentials

Each space has a `space-deployer` service account for CI pipelines (SpaceDeveloper) in that
space only. Read a login out and put it in the pipeline's secret store:

```sh
$OP terraform output -json deployer_credentials | jq '.prod'
```

## SSH access

### Cloud Foundry app containers — `cf ssh`

Gated per space by `allow_ssh` (**on** for `staging`, **off** for `prod`). The caller
also needs the `space_developer` role, which this module grants (together with
`organization_user` membership) to the accounts in `var.operators`. Any additional human
or CI identity is granted out-of-band.

```sh
cf api <api_url>            # from `terraform output api_url`
cf login --sso
cf target -o baergpt -s staging
cf ssh <app-name>          # opens a shell in instance 0
```

`prod` has SSH disabled. To debug a prod incident, set that space's `allow_ssh = true`
in `variables.tf`, `terraform apply`, then revert when done.
