# LogQL alert rules over the Kong gateway logs (infra/supabase/otel-config.yml,
# filter/gateway-only), stream label service_name = supabase-<env>.
#
# The filters match the access-log shape `"GET /path HTTP/1.1" 502 1234` — quote, space,
# three-digit status. LogQL unquotes Go-style escapes, so regex backslashes must be
# doubled (\\d); \" stays single. HCL heredocs pass backslashes through verbatim.

resource "stackit_observability_logalertgroup" "kong" {
  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "${var.env}-kong-logs"
  interval    = "60s"

  rules = [
    # A share of traffic, not an absolute rate: traffic floors near 0.003 req/s, so any
    # threshold quiet at peak is unreachable off-peak. The floor suppresses lone failures.
    {
      alert = "KongHigh5xxRate"
      expression = trimspace(<<-EOT
        sum(rate({service_name="${var.target_source}"} |~ "\" 5\\d\\d " [5m]))
          / sum(rate({service_name="${var.target_source}"} |~ "\" \\d\\d\\d " [5m]))
          > ${var.kong_5xx_ratio_max}
        and
        sum(rate({service_name="${var.target_source}"} |~ "\" 5\\d\\d " [5m]))
          > ${format("%.5f", var.kong_5xx_min_errors_5m / 300)}
      EOT
      )
      for = "2m"
      labels = {
        severity = "critical"
        source   = var.target_source
      }
      annotations = {
        summary     = "Kong 5xx above ${var.kong_5xx_ratio_max} of requests on ${var.target_source}"
        description = "The Supabase API gateway is returning {{ $value | humanizePercentage }} 5xx over 5m. Check upstream services (rest/auth/storage) and the DB."
      }
    },
  ]
}
