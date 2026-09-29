# LogQL alert rules over the Tor/Mullvad block on the Supabase VMs (infra/README.md,
# "Anonymising-egress block"), stream label service_name = supabase-<env>-anon-egress.
# That stream carries two kinds of lines: the refresh script's JSON status line (hourly) and
# nginx's access-log line for each blocked request (status 403).
#
# Same escaping rules as alerts_logs.tf: \" stays single, regex backslashes are doubled.

resource "stackit_observability_logalertgroup" "anon_egress" {
  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "${var.env}-anon-egress"
  interval    = "60s"

  rules = [
    # A failed refresh keeps the previous list, so failure is silent until this fires. The
    # timer runs hourly (+ up to 10m jitter): 3h means about three runs in a row without "ok".
    # Also fires if the collector stops shipping this file.
    {
      alert = "AnonEgressBlocklistStale"
      expression = trimspace(<<-EOT
        absent_over_time({service_name="${var.target_source}-anon-egress"} |= "\"status\": \"ok\"" [3h])
      EOT
      )
      for = "0s"
      labels = {
        severity = "critical"
        source   = var.target_source
      }
      annotations = {
        summary     = "Tor/Mullvad blocklist on ${var.target_source} not refreshed for 3h"
        description = "No successful anon-egress-blocklist run in 3h; nginx keeps blocking with the old list. The error lines in the ${var.target_source}-anon-egress Loki stream (or journalctl -u anon-egress-blocklist.service on the VM) name the reason."
      }
    },

    # Blocked requests never reach Kong, so the denominator selects both streams. Status lines
    # don't match the access-log pattern, so they stay out of both sides.
    {
      alert = "AnonEgressBlockedShareHigh"
      expression = trimspace(<<-EOT
        sum(count_over_time({service_name="${var.target_source}-anon-egress"} |~ "\" 403 " [30m]))
          / sum(count_over_time({service_name=~"${var.target_source}|${var.target_source}-anon-egress"} |~ "\" \\d\\d\\d " [30m]))
          > ${var.anon_egress_blocked_ratio_max}
        and
        sum(count_over_time({service_name="${var.target_source}-anon-egress"} |~ "\" 403 " [30m]))
          >= ${var.anon_egress_blocked_min_30m}
      EOT
      )
      for = "5m"
      labels = {
        severity = "warning"
        source   = var.target_source
      }
      annotations = {
        summary     = "Tor/Mullvad block rejecting over ${var.anon_egress_blocked_ratio_max} of requests on ${var.target_source}"
        description = "{{ $value | humanizePercentage }} of requests in the last 30m were blocked. Either real users are caught by a widened range, or someone is hammering the API via Tor/VPN. Check client addresses and user agents in /var/log/nginx/anon-egress.log (or the anon-egress stream in Loki)."
      }
    },
  ]
}
