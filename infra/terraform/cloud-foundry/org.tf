resource "stackit_scf_organization" "org" {
  project_id = var.project_id
  name       = var.org_name
  region     = var.region
  quota_id   = var.quota_id
}

# Machine user the CF provider authenticates as.
# Auto-deleted when the org is removed.
resource "stackit_scf_organization_manager" "manager" {
  project_id = var.project_id
  org_id     = stackit_scf_organization.org.org_id
  region     = var.region
}

data "stackit_scf_platform" "platform" {
  project_id  = var.project_id
  platform_id = stackit_scf_organization.org.platform_id
  region      = var.region
}
