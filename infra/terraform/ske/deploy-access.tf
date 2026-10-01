# Per-namespace deploy identity for CI. A staging deploy can only touch the staging
# namespace, so the GitHub "Staging" environment never holds credentials for prod.
resource "kubernetes_service_account_v1" "deployer" {
  for_each = var.namespaces

  metadata {
    name      = "deployer"
    namespace = kubernetes_namespace_v1.envs[each.key].metadata[0].name
  }
}

# Exactly what backend-deploy-stackit-ske.yml needs: apply the overlay and env Secrets,
# wait for and roll back the rollout, dump pods/events/logs on failure. No delete.
resource "kubernetes_role_v1" "deployer" {
  for_each = var.namespaces

  metadata {
    name      = "deployer"
    namespace = kubernetes_namespace_v1.envs[each.key].metadata[0].name
  }

  rule {
    api_groups = [""]
    resources  = ["secrets"]
    verbs      = ["get", "create", "update", "patch"]
  }
  rule {
    api_groups = [""]
    resources  = ["services"]
    verbs      = ["get", "list", "create", "update", "patch"]
  }
  rule {
    api_groups = ["apps"]
    resources  = ["deployments"]
    verbs      = ["get", "list", "watch", "create", "update", "patch"]
  }
  rule {
    api_groups = ["apps"]
    resources  = ["replicasets"]
    verbs      = ["get", "list", "watch"]
  }
  rule {
    api_groups = ["policy"]
    resources  = ["poddisruptionbudgets"]
    verbs      = ["get", "list", "create", "update", "patch"]
  }
  rule {
    api_groups = ["networking.k8s.io"]
    resources  = ["networkpolicies"]
    verbs      = ["get", "list", "create", "update", "patch"]
  }
  rule {
    api_groups = ["gateway.networking.k8s.io"]
    resources  = ["httproutes"]
    verbs      = ["get", "list", "create", "update", "patch"]
  }
  rule {
    api_groups = [""]
    resources  = ["pods", "pods/log", "events"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_role_binding_v1" "deployer" {
  for_each = var.namespaces

  metadata {
    name      = "deployer"
    namespace = kubernetes_namespace_v1.envs[each.key].metadata[0].name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.deployer[each.key].metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.deployer[each.key].metadata[0].name
    namespace = kubernetes_service_account_v1.deployer[each.key].metadata[0].namespace
  }
}

# Long-lived token; rotate with `terraform apply -replace='kubernetes_secret_v1.deployer_token["<ns>"]'`
# and update the matching 1Password item. Also invalidated by an SKE credential rotation.
resource "kubernetes_secret_v1" "deployer_token" {
  for_each = var.namespaces

  metadata {
    name      = "deployer-token"
    namespace = kubernetes_namespace_v1.envs[each.key].metadata[0].name
    annotations = {
      "kubernetes.io/service-account.name" = kubernetes_service_account_v1.deployer[each.key].metadata[0].name
    }
  }

  type                           = "kubernetes.io/service-account-token"
  wait_for_service_account_token = true
}

locals {
  admin_cluster = yamldecode(stackit_ske_kubeconfig.this.kube_config)["clusters"][0]["cluster"]

  deploy_kubeconfigs = {
    for ns in keys(var.namespaces) : ns => yamlencode({
      apiVersion = "v1"
      kind       = "Config"
      clusters = [{
        name = var.cluster_name
        cluster = {
          server                     = local.admin_cluster["server"]
          certificate-authority-data = local.admin_cluster["certificate-authority-data"]
        }
      }]
      users = [{
        name = "deployer-${ns}"
        user = { token = kubernetes_secret_v1.deployer_token[ns].data["token"] }
      }]
      contexts = [{
        name    = ns
        context = { cluster = var.cluster_name, user = "deployer-${ns}", namespace = ns }
      }]
      current-context = ns
    })
  }
}
