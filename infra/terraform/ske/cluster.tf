# One cluster for all environments (namespaces), so a version upgrade reaches all of them at once.
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
      # Image cleanup on SKE starts at 50% disk use; smaller volumes stay above it.
      volume_size = 50
      volume_type = "storage_premium_perf1"
    }
  ]

  extensions = {
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
