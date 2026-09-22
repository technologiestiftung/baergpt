variable "project_id" {
  type        = string
  description = "STACKIT project ID that owns the cluster (same project as cloud-foundry: baergpt-berlin-prod)."
}

variable "region" {
  type        = string
  default     = "eu01"
  description = "STACKIT region hosting the cluster."
}

variable "cluster_name" {
  type        = string
  default     = "baergpt"
  description = "SKE cluster name. One cluster for all environments; envs are k8s namespaces (see infra/k8s)."
}

variable "kubernetes_version_min" {
  type        = string
  description = "Minimum k8s version. Maintenance auto-patches within it; check available versions with `stackit ske options` or the portal before setting."
}

# TODO: fill in once a STACKIT Network Area (SNA) exists for this project — SKE needs
# one to attach the cluster's control plane/nodes to. Create it in the portal or a
# separate `stackit_network_area` resource, then reference its ID here.
variable "network_area_id" {
  type        = string
  description = "STACKIT Network Area ID the cluster attaches to."
}

variable "availability_zones" {
  type        = list(string)
  default     = ["eu01-1", "eu01-2", "eu01-3"]
  description = "Availability zones for the node pool. Verify exact names for the project's region via the portal."
}

# TODO: verify against STACKIT's current SKE machine-type list (portal or
# `stackit ske options`) before applying — placeholder pending Phase 0 quota check.
variable "machine_type" {
  type        = string
  default     = "c1a.2d"
  description = "VM flavor for cluster nodes."
}

# Rough estimate, NOT computed from real numbers — actual node count depends on
# machine_type's CPU/memory and each pod's resource requests, neither finalized yet.
# Pod-count basis: floor = prod (2 backend + 1 gotenberg) + staging (1 backend +
# 1 gotenberg) + sandbox (1 backend, reuses staging's gotenberg) = 6 app pods, plus
# ~5-8 cluster-wide platform pods (envoy-gateway + its proxy, cert-manager, OTel,
# metrics-server).
# Peak = prod backend HPA maxes at 6, staging at 2 -> 11 app pods + same platform pods.
variable "node_pool_min" {
  type        = number
  default     = 3
  description = "Minimum node count"
}

variable "node_pool_max" {
  type        = number
  default     = 6
  description = "Maximum node count"
}

variable "maintenance_window" {
  type = object({
    start = string # "HH:MM:SSZ"
    end   = string
  })
  default = {
    start = "02:00:00Z"
    end   = "04:00:00Z"
  }
  description = "Daily UTC maintenance window for patch-version + machine-image updates."
}

# --- Phase 2: cluster platform layer (platform.tf) ---------------------------------

variable "namespaces" {
  type = map(object({
    quota_cpu    = string # e.g. "4" (cores)
    quota_memory = string # e.g. "8Gi"
    quota_pods   = string # e.g. "20"
    hostname     = string # public hostname for this env's Gateway listener
  }))
  default = {
    # prod memory must cover HPA max PLUS one surge pod during a rolling update:
    # backend 6x512Mi + gotenberg 3x1536Mi = 7680Mi already, and maxSurge adds another
    # gotenberg pod (1536Mi). An 8Gi cap would leave the surge pod Pending and stall
    # the rollout until `rollout status` times out.
    staging = { quota_cpu = "2", quota_memory = "4Gi", quota_pods = "15", hostname = "api.staging.baergpt.berlin" }
    prod    = { quota_cpu = "6", quota_memory = "12Gi", quota_pods = "20", hostname = "api.baergpt.berlin" }
    sandbox = { quota_cpu = "1", quota_memory = "2Gi", quota_pods = "10", hostname = "api.sandbox.baergpt.berlin" }
  }
  description = "Per-env namespaces: ResourceQuota caps + the public hostname of that env's Gateway listener. Quota values are placeholders — size against real workload requests (see node_pool_min/max comment). Hostnames must match the HTTPRoute hostnames in infra/k8s/overlays/<env>."
}

variable "letsencrypt_email" {
  type        = string
  description = "Contact email for the Let's Encrypt ACME account (expiry/abuse notices)."
}

variable "letsencrypt_acme_server" {
  type        = string
  default     = "https://acme-staging-v02.api.letsencrypt.org/directory"
  description = "ACME server URL. Defaults to LE's STAGING endpoint (untrusted certs, no rate limits) — switch to https://acme-v02.api.letsencrypt.org/directory once ingress + DNS are verified working end to end."
}

variable "ghcr_username" {
  type        = string
  description = "GitHub username/org for the GHCR image-pull credential (a PAT with read:packages, or the repo owner if the package is public — in which case this whole secret is skippable)."
}

variable "ghcr_token" {
  type        = string
  sensitive   = true
  description = "GHCR read token (PAT with read:packages scope). Pass via -var or TF_VAR_ghcr_token from 1Password, never committed."
}
