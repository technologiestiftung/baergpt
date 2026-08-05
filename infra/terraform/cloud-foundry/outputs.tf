output "api_url" {
  value       = data.stackit_scf_platform.platform.api_url
  description = "Cloud Foundry API URL (use with `cf api`)."
}

output "deployer_credentials" {
  value       = { for space, binding in cloudfoundry_service_credential_binding.deployer : space => binding.credential_binding }
  sensitive   = true
  description = "Per-space CI login, keyed by space name."
}
