# STACKIT Kubernetes Engine (SKE) cluster (Terraform)

Provisions a single SKE cluster (`baergpt`) that hosts all environments as k8s
namespaces (`staging`, `prod`, `sandbox`). Replaces
`infra/terraform/cloud-foundry` once the migration completes; both can coexist during
the cutover.

## Layout

| File                   | Manages                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| `versions.tf`          | Terraform + provider pins; S3 remote-state backend                |
| `provider.tf`          | `stackit` provider + kubeconfig resource; wires `kubernetes`/`helm` providers for the platform layer |
| `variables.tf`         | project id, region, cluster/node-pool sizing, maintenance window  |
| `cluster.tf`           | the `stackit_ske_cluster` resource                                |
| `platform.tf`          | Envoy Gateway + cert-manager, the shared Gateway + its static public IP + HTTPS redirect, namespaces, quotas, network policies |
| `dns.tf`               | the `baergpt-ske.stackit.rocks` STACKIT DNS zone and one `A` record per namespace hostname |
| `deploy-access.tf`     | per-namespace `deployer` service account, Role and token for CI    |
| `outputs.tf`           | cluster name, admin kubeconfig, per-namespace deploy kubeconfigs  |
| `.op.env.ske.*`        | 1Password `op://` refs for `op run` auth (real file gitignored)   |
| `terraform.tfvars.example` | copy → `terraform.tfvars` (gitignored)                        |

## Prerequisites

- STACKIT project quota for SKE (nodes, LBs, volumes).
- Machine types and k8s versions available to the project: `stackit ske options`.

## Apply

```sh
cp terraform.tfvars.example terraform.tfvars              # fill in project_id, versions
cp .op.env.ske.example .op.env.ske                         # point op:// refs at your 1Password items

OP="op run --env-file .op.env.ske --"

$OP terraform init
```

### First apply is staged (three steps)

This module creates a cluster **and** configures the `kubernetes`/`helm` providers from
that cluster's credentials, so the first apply cannot be done in one pass. Same class of
bootstrap problem the `cloud-foundry` module has, for the same reason.

```sh
# 1. cluster + its kubeconfig. Until these exist, the kubernetes/helm provider config
#    references values Terraform cannot know at plan time.
$OP terraform apply -target=stackit_ske_kubeconfig.this

# 2. the Helm charts. Both must be installed before step 3, because the CRDs they
#    ship (gateway.networking.k8s.io for GatewayClass/Gateway, cert-manager.io for
#    ClusterIssuer) have to exist in the API server before `kubernetes_manifest` will
#    even *plan* — it validates the kind against the live cluster, and `depends_on`
#    does not defer that.
$OP terraform apply -target=helm_release.envoy_gateway -target=helm_release.cert_manager

# 3. everything else (GatewayClass, Gateway, ClusterIssuer, namespaces, quotas,
#    network policies, pull secrets)
$OP terraform apply
```

Every later change is a plain `$OP terraform apply` — the staging is only needed while
the cluster and the Gateway API / cert-manager CRDs don't exist yet.

> If this bootstrap becomes annoying (e.g. rebuilding the cluster from scratch often),
> the cleaner fix is to split the platform layer into its own module that takes a
> kubeconfig path as an input variable, so no provider is ever configured from a
> resource created in the same run. Not done yet — it would mean a second state file
> and another `.op.env`, which isn't worth it for a cluster we expect to create once.

## Kubeconfig

`stackit_ske_kubeconfig` issues a short-lived (1h, auto-refreshed) admin kubeconfig,
exposed as the sensitive `kube_config` output. It exists so this module's
`kubernetes`/`helm` providers can install the platform layer (`platform.tf`).

The deploy workflow never gets admin access. `deploy-access.tf` creates a `deployer`
service account per namespace whose Role covers only that namespace, and
`deploy_kubeconfigs` renders one kubeconfig per namespace from its token. Store each in
1Password as a `kubeconfig` field:

| Namespace | 1Password item referenced by                        |
| --------- | --------------------------------------------------- |
| `prod`    | `OP_SKE_DEPLOY_ITEM_ID` (GitHub "Production" env)   |
| `staging` | `OP_SKE_DEPLOY_ITEM_ID` (GitHub "Staging" env)      |
| `sandbox` | `OP_SKE_DEPLOY_SANDBOX_ITEM_ID` (GitHub "Staging" env) |

```sh
$OP terraform output -json deploy_kubeconfigs | jq -r '.staging'
```

The tokens don't expire. Rotate one with
`$OP terraform apply -replace='kubernetes_secret_v1.deployer_token["<ns>"]'` and update its
1Password item; an SKE credential rotation invalidates all of them.

## Remote state

Same `baergpt-tfstate` STACKIT Object Storage bucket as the other Terraform modules,
key `ske/terraform.tfstate`. No state locking (STACKIT doesn't honor S3 conditional
writes) — avoid concurrent applies.
