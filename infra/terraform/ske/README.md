# STACKIT Kubernetes Engine (SKE) cluster (Terraform)

Provisions a single SKE cluster (`baergpt`) that hosts all environments as k8s
namespaces (`staging`, `prod`, `sandbox`).

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
cp terraform.tfvars.example terraform.tfvars   # fill in project_id, versions
cp .op.env.ske.example .op.env.ske             # point the op:// refs at your 1Password items

op run --env-file .op.env.ske -- terraform init
```

### First apply is staged (three steps)

The `kubernetes`/`helm` providers are configured from the cluster this module creates, and
`kubernetes_manifest` checks its kinds against the live cluster at plan time. On a new
cluster the first apply therefore runs in three steps:

```sh
# 1. the cluster and its kubeconfig
op run --env-file .op.env.ske -- terraform apply -target=stackit_ske_kubeconfig.this
# 2. the charts that install the Gateway API and cert-manager CRDs
op run --env-file .op.env.ske -- terraform apply -target=helm_release.envoy_gateway -target=helm_release.cert_manager
# 3. everything else
op run --env-file .op.env.ske -- terraform apply
```

Every later change is a single `terraform apply`.

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
op run --env-file .op.env.ske -- terraform output -json deploy_kubeconfigs | jq -r '.staging'
```

The tokens don't expire. Rotate one with
`op run --env-file .op.env.ske -- terraform apply -replace='kubernetes_secret_v1.deployer_token["<ns>"]'`
and update its 1Password item; an SKE credential rotation invalidates all of them.

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
  (access logs; `downstream_remote_address` is the client's IP, which the load balancer passes
  to Envoy in a PROXY protocol header) and `cert-manager`. Loki stream label `service_name="ske-<namespace>"`;
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

### Alerts

Rules live in `infra/terraform/observability/alerts_ske.tf` (applied from that module's
`production` workspace). They cover `prod` (critical) and `staging` (warning); `sandbox` has no
alerts. Certificate expiry comes from cert-manager's metrics, which `otel-collector-cluster`
scrapes (`prometheus/cert-manager`, only the `certmanager_certificate_*` series).

### Verify after an apply

- `kubectl -n observability get pods -o wide`: one `otel-collector-…-agent` pod per node and one
  `otel-collector-cluster-…` pod, all Running.
- Grafana Explore → Loki → `{service_name=~"ske-.*"}` returns lines.
- Grafana Explore → Thanos → `k8s_pod_phase{source="ske"}` and
  `container_memory_working_set_bytes{source="ske"}` return series. If a dashboard panel is
  empty, look up the actual metric name in Explore; the names come from the collector's
  Prometheus translation.

## Updates

| What                                  | Kept current by                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kubernetes patch versions, node OS    | STACKIT, in the maintenance window (`cluster.tf`)                                                                                                                                                                                                                                                                     |
| Kubernetes minor versions             | by hand, before the current version expires (STACKIT then force-upgrades it in the maintenance window; the date is in `stackit ske cluster describe baergpt`): raise `kubernetes_version_min`, check the Envoy Gateway and cert-manager compatibility notes in `platform.tf`, bump `KUBECTL_VERSION` in the workflows |
| Helm charts (`helm_release` versions) | Renovate                                                                                                                                                                                                                                                                                                              |
| OTel collector image                  | Renovate, via the `# renovate:` comment in `observability.tf` (grouped with the chart)                                                                                                                                                                                                                                |
| Terraform providers, lock file        | Renovate                                                                                                                                                                                                                                                                                                              |

A merged Renovate PR only changes the repo: the cluster picks it up on the next
`terraform apply`. Pod Security labels use `latest`, so they follow the cluster's version.

## Remote state

Same `baergpt-tfstate` STACKIT Object Storage bucket as the other Terraform modules,
key `ske/terraform.tfstate`. No state locking (STACKIT doesn't honor S3 conditional
writes) — avoid concurrent applies.
