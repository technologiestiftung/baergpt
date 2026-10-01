# Free STACKIT subdomain zone; every environment's hostname lives in it.
resource "stackit_dns_zone" "this" {
  project_id = var.project_id
  name       = "baergpt-ske"
  dns_name   = var.dns_zone
}

resource "stackit_dns_record_set" "envs" {
  for_each = var.namespaces

  project_id = var.project_id
  zone_id    = stackit_dns_zone.this.zone_id
  name       = trimsuffix(each.value.hostname, ".${var.dns_zone}")
  type       = "A"
  records    = [stackit_public_ip.gateway.ip]
  ttl        = 300

  lifecycle {
    precondition {
      condition     = endswith(each.value.hostname, ".${var.dns_zone}")
      error_message = "Hostname ${each.value.hostname} is not inside the zone ${var.dns_zone}."
    }
  }
}
