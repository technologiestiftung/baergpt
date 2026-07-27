# PromQL alert rules over the Supabase VM telemetry (infra/supabase/MONITORING.md).
# The collector emits *_usage_bytes, not the *_utilization metrics (disabled by default),
# so disk and memory are expressed as used/total ratios.

resource "stackit_observability_alertgroup" "host" {
  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "${var.env}-host"
  interval    = "60s"

  rules = [
    # Push pipeline has no `up` metric, so absence of an always-present series is the signal.
    # absent_over_time's own [5m] window is the detection delay, so for = "0s" (a plain
    # absent() only flips true after staleness, and for = "5m" would then double the delay).
    {
      alert = "HostOrCollectorDown"
      expression = trimspace(<<-EOT
        absent_over_time(system_memory_usage_bytes{source="${var.target_source}"}[5m])
      EOT
      )
      for = "0s"
      labels = {
        severity = "critical"
        source   = var.target_source
      }
      annotations = {
        summary     = "No metrics from ${var.target_source} for 5m"
        description = "The Supabase VM or its OTel collector stopped reporting. Check the host and the otel-collector container."
      }
    },

    # mode="rw" excludes read-only mounts (snap squashfs loops), which sit at 100% forever.
    {
      alert = "DiskAlmostFull"
      expression = trimspace(<<-EOT
        sum by (host, mountpoint) (system_filesystem_usage_bytes{source="${var.target_source}", mode="rw", state="used"})
          / sum by (host, mountpoint) (system_filesystem_usage_bytes{source="${var.target_source}", mode="rw", state=~"used|free"})
          > ${var.disk_used_ratio_max}
      EOT
      )
      for = "10m"
      labels = {
        severity = "critical"
        source   = var.target_source
      }
      annotations = {
        summary     = "Disk above ${var.disk_used_ratio_max} on ${var.target_source}"
        description = "Filesystem {{ $labels.mountpoint }} on {{ $labels.host }} is over {{ $value | humanizePercentage }} full."
      }
    },

    # These states sum to MemTotal; summing all of them double-counts slab (`cached`
    # already includes SReclaimable) and makes the alert fire late.
    {
      alert = "MemoryHigh"
      expression = trimspace(<<-EOT
        sum by (host) (system_memory_usage_bytes{source="${var.target_source}", state="used"})
          / sum by (host) (system_memory_usage_bytes{source="${var.target_source}", state=~"used|free|cached|buffered"})
          > ${var.mem_used_ratio_max}
      EOT
      )
      for = "5m"
      labels = {
        severity = "warning"
        source   = var.target_source
      }
      annotations = {
        summary     = "Memory above ${var.mem_used_ratio_max} on ${var.target_source}"
        description = "Used memory on {{ $labels.host }} has been over {{ $value | humanizePercentage }} for 5m."
      }
    },

    {
      alert = "CPULoadHigh"
      expression = trimspace(<<-EOT
        system_cpu_load_average_15m{source="${var.target_source}"} > ${var.cpu_load_15m_max}
      EOT
      )
      for = "15m"
      labels = {
        severity = "warning"
        source   = var.target_source
      }
      annotations = {
        summary     = "15m load average above ${var.cpu_load_15m_max} on ${var.target_source}"
        description = "Load on {{ $labels.host }} has been {{ $value }} for 15m (threshold ${var.cpu_load_15m_max})."
      }
    },
  ]
}
