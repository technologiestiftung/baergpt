# Broker-managed technical users for CI. Creating the instance provisions a user, adds it
# to that one space and grants it SpaceDeveloper, so a prod credential cannot reach staging.
data "cloudfoundry_service_plans" "space_deployer" {
  service_offering_name = "space-scoped-service-account"
  name                  = "space-deployer"
}

# Org-manager rights stop at the org boundary, and creating a service instance is a
# space-level action, so Terraform's own identity needs a role inside each space via
# org membership first.
resource "cloudfoundry_org_role" "manager" {
  username = stackit_scf_organization_manager.manager.username
  type     = "organization_user"
  org      = stackit_scf_organization.org.org_id
}

resource "cloudfoundry_space_role" "manager" {
  for_each = cloudfoundry_space.this
  user     = cloudfoundry_org_role.manager.user
  type     = "space_developer"
  space    = each.value.id
}

resource "cloudfoundry_service_instance" "deployer" {
  for_each     = cloudfoundry_space.this
  name         = "${each.key}-deployer"
  type         = "managed"
  space        = each.value.id
  service_plan = data.cloudfoundry_service_plans.space_deployer.service_plans[0].id

  depends_on = [cloudfoundry_space_role.manager]
}

resource "cloudfoundry_service_credential_binding" "deployer" {
  for_each         = cloudfoundry_service_instance.deployer
  type             = "key"
  name             = "ci"
  service_instance = each.value.id
}
