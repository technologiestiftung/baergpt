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

variable "availability_zones" {
  type        = list(string)
  default     = ["eu01-1", "eu01-2", "eu01-3"]
  description = "Availability zones for the node pool. Verify exact names for the project's region via the portal."
}

variable "machine_type" {
  type        = string
  default     = "g1a.4d" # AMD x86, 4 vCPU / 16 GB: the backend image is built for linux/amd64 only
  description = "VM flavor for cluster nodes. List available types with `stackit ske options`."
}

# Floor memory requests ≈ 26Gi: prod 4×4Gi backend + 2×2Gi gotenberg, staging/sandbox
# ~3Gi, platform + observability ~3Gi. 3 nodes (~40Gi allocatable) also absorb a prod
# rollout's surge pods; the max leaves room for node failures and new workloads.
variable "node_pool_min" {
  type        = number
  default     = 3
  description = "Minimum node count"
}

variable "node_pool_max" {
  type        = number
  default     = 5
  description = "Maximum node count"
}

variable "observability_instance_id" {
  type        = string
  description = "STACKIT Observability instance the SKE observability extension ships metrics to."
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

# --- Cluster platform layer (platform.tf) -----------------------------------------

variable "namespaces" {
  type = map(object({
    quota_cpu    = string # e.g. "4" (cores)
    quota_memory = string # e.g. "8Gi"
    quota_pods   = string # e.g. "20"
    hostname     = string # public hostname for this env's Gateway listener
  }))
  default = {
    # quota_memory caps requests AND limits, so it must cover the sum of memory limits
    # plus one surge pod per Deployment during a rolling update — otherwise the surge
    # pod is rejected and the rollout stalls. prod: 4×4Gi + 2×2Gi + 4Gi + 2Gi = 26Gi.
    staging = { quota_cpu = "2", quota_memory = "12Gi", quota_pods = "15", hostname = "api-staging.baergpt-ske.stackit.rocks" }
    prod    = { quota_cpu = "4", quota_memory = "26Gi", quota_pods = "20", hostname = "api.baergpt-ske.stackit.rocks" }
    sandbox = { quota_cpu = "1", quota_memory = "8Gi", quota_pods = "10", hostname = "api-sandbox.baergpt-ske.stackit.rocks" }
  }
  description = "Per-env namespaces: ResourceQuota caps + the public hostname of that env's Gateway listener. Keep quotas in sync with the resources in infra/k8s. Hostnames must match the HTTPRoute hostnames in infra/k8s/overlays/<env>."
}

variable "dns_zone" {
  type        = string
  default     = "baergpt-ske.stackit.rocks"
  description = "STACKIT DNS zone holding every namespace hostname (dns.tf)."
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
