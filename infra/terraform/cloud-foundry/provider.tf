provider "stackit" {
  default_region = var.region
}

# Configured from the technical org-manager user created in org.tf. On the FIRST apply these
# values are unknown, so the org-manager must be applied first with -target (see README).
provider "cloudfoundry" {
  api_url  = data.stackit_scf_platform.platform.api_url
  user     = stackit_scf_organization_manager.manager.username
  password = stackit_scf_organization_manager.manager.password
}
