output "cluster_name" {
  value       = stackit_ske_cluster.this.name
  description = "SKE cluster name (for `stackit ske kubeconfig create` / kubectl context)."
}

output "kube_config" {
  value       = stackit_ske_kubeconfig.this.kube_config
  sensitive   = true
  description = "Short-lived admin kubeconfig for local operator use."
}

output "deploy_kubeconfigs" {
  value       = local.deploy_kubeconfigs
  sensitive   = true
  description = "Per-namespace kubeconfig for the deploy workflow, scoped to that namespace only. Store each in the 1Password item the workflow reads."
}

output "gateway_ip" {
  value       = stackit_public_ip.gateway.ip
  description = "Static public IP of the shared Gateway's load balancer."
}
