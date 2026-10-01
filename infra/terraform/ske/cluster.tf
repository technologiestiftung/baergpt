# Single cluster for all environments; staging/prod/sandbox are k8s namespaces on it.
# Trade-off: a k8s version upgrade touches all envs at once, so test against the
# sandbox/staging namespaces before relying on it in prod.
resource "stackit_ske_cluster" "this" {
  project_id             = var.project_id
  region                 = var.region
  name                   = var.cluster_name
  kubernetes_version_min = var.kubernetes_version_min

  node_pools = [
    {
      name               = "default"
      machine_type       = var.machine_type
      availability_zones = var.availability_zones
      minimum            = var.node_pool_min
      maximum            = var.node_pool_max
      volume_size        = 20
      volume_type        = "storage_premium_perf1"
    }
  ]

  extensions = {
    # Forwards cluster and node metrics to the STACKIT Observability instance.
    observability = {
      enabled     = true
      instance_id = var.observability_instance_id
    }
  }

  maintenance = {
    enable_kubernetes_version_updates    = true
    enable_machine_image_version_updates = true
    start                                = var.maintenance_window.start
    end                                  = var.maintenance_window.end
  }
}
