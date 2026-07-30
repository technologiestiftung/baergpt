# App-Autoscaler service instance, one per space. This is the durable half of
# autoscaling: the managed service instance is provisioned once and lives
# independently of any app deploy. The *policy* (min/max instances + scaling
# rules) is NOT set here — it's attached per-app by the deploy workflow from a
# committed JSON file, because the apps themselves are created by `cf push` in
# CI, not by Terraform (see backend-deploy-stackit-cf.yml and gotenberg-deploy-stackit-cf.yml).

# The free autoscaler plan offered by the STACKIT marketplace ("autoscaler"
# broker). allow_paid_service_plans stays false on the space quota because this
# plan is free.
data "cloudfoundry_service_plans" "autoscaler" {
  name                  = "autoscaler-free-plan"
  service_offering_name = "autoscaler"
}

resource "cloudfoundry_service_instance" "autoscaler" {
  for_each     = var.spaces
  name         = "${each.key}-autoscaler"
  space        = cloudfoundry_space.this[each.key].id
  type         = "managed"
  service_plan = data.cloudfoundry_service_plans.autoscaler.service_plans[0].id
  depends_on   = [cloudfoundry_space_role.manager]
}
