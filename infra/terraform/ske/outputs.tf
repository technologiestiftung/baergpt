output "cluster_name" {
  value       = stackit_ske_cluster.this.name
  description = "SKE cluster name (for `stackit ske kubeconfig create` / kubectl context)."
}

output "kube_config" {
  value       = stackit_ske_kubeconfig.this.kube_config
  sensitive   = true
  description = "Short-lived admin kubeconfig. CI fetches this at deploy time rather than persisting it anywhere."
}
