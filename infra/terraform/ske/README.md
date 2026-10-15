# STACKIT Kubernetes Engine (SKE) cluster (Terraform)

Provisions a single SKE cluster (`baergpt`) that hosts all environments as k8s
namespaces (`staging`, `prod`, `sandbox`). Replaces
`infra/terraform/cloud-foundry` once the migration completes; both can coexist during
the cutover.

## Layout

| File                       | Manages                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `versions.tf`              | Terraform + provider pins; S3 remote-state backend                                                                                                                                                   |
| `provider.tf`              | `stackit` provider + kubeconfig resource; wires `kubernetes`/`helm` providers for the platform layer                                                                                                 |
| `variables.tf`             | project id, region, cluster/node-pool sizing, maintenance window                                                                                                                                     |
| `cluster.tf`               | the `stackit_ske_cluster` resource                                                                                                                                                                   |
| `platform.tf`              | Envoy Gateway + cert-manager, the shared Gateway + its static public IP + HTTPS redirect, namespaces, quotas, network policies, a ClusterIP-only admission policy for Services in the env namespaces |
| `dns.tf`                   | the `baergpt-ske.stackit.rocks` STACKIT DNS zone and one `A` record per namespace hostname                                                                                                           |
| `deploy-access.tf`         | per-namespace `deployer` service account, Role and token for CI                                                                                                                                      |
| `observability.tf`         | otel-collectors shipping logs, metrics and Kubernetes events to STACKIT Observability                                                                                                                |
| `grafana/`                 | Grafana dashboard for the cluster (import by hand)                                                                                                                                                   |
| `outputs.tf`               | cluster name, admin kubeconfig, per-namespace deploy kubeconfigs                                                                                                                                     |
| `.op.env.ske.*`            | 1Password `op://` refs for `op run` auth (real file gitignored)                                                                                                                                      |
| `terraform.tfvars.example` | copy → `terraform.tfvars` (gitignored)                                                                                                                                                               |

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

# 3. everything else (GatewayClass, Gateway + its public IP and DNS records, ClusterIssuer,
#    namespaces, quotas, network policies, deployer service accounts)
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

| Namespace | 1Password item referenced by                           |
| --------- | ------------------------------------------------------ |
| `prod`    | `OP_SKE_DEPLOY_ITEM_ID` (GitHub "Production" env)      |
| `staging` | `OP_SKE_DEPLOY_ITEM_ID` (GitHub "Staging" env)         |
| `sandbox` | `OP_SKE_DEPLOY_SANDBOX_ITEM_ID` (GitHub "Staging" env) |

```sh
$OP terraform output -json deploy_kubeconfigs | jq -r '.staging'
```

The tokens don't expire. Rotate one with
`$OP terraform apply -replace='kubernetes_secret_v1.deployer_token["<ns>"]'` and update its
1Password item; an SKE credential rotation invalidates all of them.

## Logs, metrics and events

`observability.tf` installs two OpenTelemetry Collectors (namespace `observability`) that ship
to the same Observability instance as the Supabase VMs, with their own credential
(`stackit_observability_credential.otel_collector`). The SKE observability extension in
`cluster.tf` only covers kube-system and node metrics.

| Collector                | Runs                        | Ships                                                                                           |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------- |
| `otel-collector`         | DaemonSet, one pod per node | container logs from `/var/log/pods`; pod/container CPU, memory, network from the node's kubelet |
| `otel-collector-cluster` | Deployment, 1 replica       | Deployment/pod/container state, restarts, limits, ResourceQuota usage; Kubernetes events        |

- **Logs**: only the env namespaces (`staging`, `prod`, `sandbox`), `envoy-gateway-system`
  (access logs; `downstream_remote_address` is a node address, not the client's IP, because the
  load balancer doesn't pass it on) and `cert-manager`. Loki stream label `service_name="ske-<namespace>"`;
  narrow down by pod or container with a label filter, e.g.
  `{service_name="ske-prod"} | k8s_container_name="backend" |= "[MEMORY]"`.
- **Events**: `service_name="ske-events"`, all namespaces; the body is the event as JSON, e.g.
  `{service_name="ske-events"} | json | object_type="Warning" | object_regarding_namespace="prod"`.
- **Metrics**: every series has `source="ske"` plus `k8s_namespace_name`, `k8s_pod_name`,
  `k8s_container_name`. Main ones: `container_memory_working_set_bytes`,
  `k8s_container_memory_limit_bytes`, `container_cpu_usage`, `k8s_container_restarts`,
  `k8s_deployment_available`/`_desired`, `k8s_resource_quota_used`/`_hard_limit`.
  Kubelet metrics are cut down to an allowlist (`filter/kubelet-metrics`, sampled every
  30s; cluster metrics every 60s) to stay well under the Observability plan's
  samples-per-minute limit. Add a kubelet metric to the allowlist before building a panel
  or alert on it.

The log collector runs as root in a `privileged` Pod Security namespace because the log files
are root-owned and need a hostPath mount. Neither collector has network listeners.

### Dashboard

Import [`grafana/ske-cluster-dashboard.json`](./grafana/ske-cluster-dashboard.json) in Grafana
(Dashboards → New → Import), pick the Thanos and Loki datasources, and choose the namespace at
the top. Panels: replica availability, restarts, quota usage, memory as % of limit, CPU, node
usage, collector health, Warning events and logs.

### Verify after an apply

- `kubectl -n observability get pods -o wide`: one `otel-collector-…-agent` pod per node and one
  `otel-collector-cluster-…` pod, all Running.
- Grafana Explore → Loki → `{service_name=~"ske-.*"}` returns lines.
- Grafana Explore → Thanos → `k8s_pod_phase{source="ske"}` and
  `container_memory_working_set_bytes{source="ske"}` return series. If a dashboard panel is
  empty, look up the actual metric name in Explore; the names come from the collector's
  Prometheus translation.

## Updates

| What                                  | Kept current by                                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kubernetes patch versions, node OS    | STACKIT, in the maintenance window (`cluster.tf`)                                                                                                               |
| Kubernetes minor versions             | by hand: raise `kubernetes_version_min`, check the Envoy Gateway and cert-manager compatibility notes in `platform.tf`, bump `KUBECTL_VERSION` in the workflows |
| Helm charts (`helm_release` versions) | Renovate                                                                                                                                                        |
| OTel collector image                  | Renovate, via the `# renovate:` comment in `observability.tf` (grouped with the chart)                                                                          |
| Terraform providers, lock file        | Renovate                                                                                                                                                        |

A merged Renovate PR only changes the repo: the cluster picks it up on the next
`terraform apply`. Pod Security labels use `latest`, so they follow the cluster's version.

## Remote state

Same `baergpt-tfstate` STACKIT Object Storage bucket as the other Terraform modules,
key `ske/terraform.tfstate`. No state locking (STACKIT doesn't honor S3 conditional
writes) — avoid concurrent applies.
