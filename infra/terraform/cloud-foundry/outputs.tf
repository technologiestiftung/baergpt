output "api_url" {
  value       = data.stackit_scf_platform.platform.api_url
  description = "Cloud Foundry API URL (use with `cf api`)."
}
