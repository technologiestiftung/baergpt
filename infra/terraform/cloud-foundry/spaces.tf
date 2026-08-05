resource "cloudfoundry_space" "this" {
  for_each  = var.spaces
  name      = each.key
  org       = stackit_scf_organization.org.org_id
  allow_ssh = each.value.allow_ssh
}

resource "cloudfoundry_space_quota" "this" {
  for_each                 = var.spaces
  name                     = "${each.key}-quota"
  org                      = stackit_scf_organization.org.org_id
  allow_paid_service_plans = false
  total_memory             = each.value.total_memory
  total_app_instances      = each.value.total_app_instances
  total_routes             = each.value.total_routes
  spaces                   = [cloudfoundry_space.this[each.key].id]
}

# Access is granted in two steps. Step 1: make each operator account a member of the CF
# org. CF refuses to grant any per-space role to someone who isn't an org member first.
resource "cloudfoundry_org_role" "member" {
  for_each = toset(var.operators)
  username = each.value
  type     = "organization_user"
  org      = stackit_scf_organization.org.org_id
}

# Step 2: give each operator the "developer" role in BOTH spaces — the role that lets them
# deploy and manage apps in each. (cf ssh also needs allow_ssh, so it works on staging only.)
resource "cloudfoundry_space_role" "developer" {
  for_each = merge([
    for operator in var.operators : {
      for space_name in keys(var.spaces) :
      "${operator}:${space_name}" => { username = operator, space = space_name }
    }
  ]...)
  user  = cloudfoundry_org_role.member[each.value.username].user
  type  = "space_developer"
  space = cloudfoundry_space.this[each.value.space].id
}
