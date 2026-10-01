provider "stackit" {
  default_region = var.region
}

# Cluster admin credentials for the kubernetes/helm providers (platform layer).
# Short-lived; regenerated automatically via `refresh` so a long-running `terraform
# apply` (or repeated applies) doesn't hit an expired kubeconfig.
resource "stackit_ske_kubeconfig" "this" {
  project_id   = var.project_id
  cluster_name = stackit_ske_cluster.this.name
  refresh      = true
  expiration   = 3600
}

provider "kubernetes" {
  host                   = yamldecode(stackit_ske_kubeconfig.this.kube_config)["clusters"][0]["cluster"]["server"]
  cluster_ca_certificate = base64decode(yamldecode(stackit_ske_kubeconfig.this.kube_config)["clusters"][0]["cluster"]["certificate-authority-data"])
  client_certificate     = base64decode(yamldecode(stackit_ske_kubeconfig.this.kube_config)["users"][0]["user"]["client-certificate-data"])
  client_key             = base64decode(yamldecode(stackit_ske_kubeconfig.this.kube_config)["users"][0]["user"]["client-key-data"])
}

provider "helm" {
  kubernetes = {
    host                   = yamldecode(stackit_ske_kubeconfig.this.kube_config)["clusters"][0]["cluster"]["server"]
    cluster_ca_certificate = base64decode(yamldecode(stackit_ske_kubeconfig.this.kube_config)["clusters"][0]["cluster"]["certificate-authority-data"])
    client_certificate     = base64decode(yamldecode(stackit_ske_kubeconfig.this.kube_config)["users"][0]["user"]["client-certificate-data"])
    client_key             = base64decode(yamldecode(stackit_ske_kubeconfig.this.kube_config)["users"][0]["user"]["client-key-data"])
  }
}
