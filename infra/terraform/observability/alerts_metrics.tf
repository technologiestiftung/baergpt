# PromQL alert rules over the Supabase VM telemetry (infra/supabase/MONITORING.md).
# The collector emits *_usage_bytes, not the *_utilization metrics (disabled by default),
# so disk and memory are expressed as used/total ratios.
# One group for both VMs. Don't set a static `source` rule label: it overwrites the series' own.

locals {
  supabase_sources      = ["supabase-production", "supabase-staging"]
  supabase_source_regex = join("|", local.supabase_sources)

  # Wraps a PromQL expression whose series carry `source`: production critical, staging warning.
  supabase_severity_by_source = {
    prefix = "label_replace(label_replace("
    suffix = ", \"severity\", \"critical\", \"source\", \"supabase-production\"), \"severity\", \"warning\", \"source\", \"supabase-staging\")"
  }
}

resource "stackit_observability_alertgroup" "host" {
  count = local.shared_alerts_enabled ? 1 : 0

  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "supabase-host"
  interval    = "60s"

  rules = [
    # Push pipeline has no `up` metric, so absence of an always-present series is the signal.
    # absent_over_time's own [5m] window is the detection delay, so for = "0s" (a plain
    # absent() only flips true after staleness, and for = "5m" would then double the delay).
    # One absent_over_time per VM: a regex matcher only fires once all are silent and drops `source`.
    {
      alert = "HostOrCollectorDown"
      expression = trimspace(<<-EOT
        ${local.supabase_severity_by_source.prefix}
          ${join("\n  or ", [for s in local.supabase_sources : "absent_over_time(system_memory_usage_bytes{source=\"${s}\"}[5m])"])}
        ${local.supabase_severity_by_source.suffix}
      EOT
      )
      for = "0s"
      annotations = {
        summary     = "No metrics from {{ $labels.source }} for 5m"
        description = "The Supabase VM or its OTel collector stopped reporting. Check the host and the otel-collector container."
      }
    },

    # mode="rw" excludes read-only mounts (snap squashfs loops), which sit at 100% forever.
    {
      alert = "DiskAlmostFull"
      expression = trimspace(<<-EOT
        ${local.supabase_severity_by_source.prefix}
          sum by (source, host, mountpoint) (system_filesystem_usage_bytes{source=~"${local.supabase_source_regex}", mode="rw", state="used"})
            / sum by (source, host, mountpoint) (system_filesystem_usage_bytes{source=~"${local.supabase_source_regex}", mode="rw", state=~"used|free"})
            > ${var.disk_used_ratio_max}
        ${local.supabase_severity_by_source.suffix}
      EOT
      )
      for = "10m"
      annotations = {
        summary     = "Disk above ${var.disk_used_ratio_max} on {{ $labels.source }}"
        description = "Filesystem {{ $labels.mountpoint }} on {{ $labels.host }} is over {{ $value | humanizePercentage }} full."
      }
    },

    # These states sum to MemTotal; summing all of them double-counts slab (`cached`
    # already includes SReclaimable) and makes the alert fire late.
    {
      alert = "MemoryHigh"
      expression = trimspace(<<-EOT
        sum by (source, host) (system_memory_usage_bytes{source=~"${local.supabase_source_regex}", state="used"})
          / sum by (source, host) (system_memory_usage_bytes{source=~"${local.supabase_source_regex}", state=~"used|free|cached|buffered"})
          > ${var.mem_used_ratio_max}
      EOT
      )
      for = "5m"
      labels = {
        severity = "warning"
      }
      annotations = {
        summary     = "Memory above ${var.mem_used_ratio_max} on {{ $labels.source }}"
        description = "Used memory on {{ $labels.host }} has been over {{ $value | humanizePercentage }} for 5m."
      }
    },

    {
      alert = "CPULoadHigh"
      expression = trimspace(<<-EOT
        system_cpu_load_average_15m{source=~"${local.supabase_source_regex}"} > ${var.cpu_load_15m_max}
      EOT
      )
      for = "15m"
      labels = {
        severity = "warning"
      }
      annotations = {
        summary     = "15m load average above ${var.cpu_load_15m_max} on {{ $labels.source }}"
        description = "Load on {{ $labels.host }} has been {{ $value }} for 15m (threshold ${var.cpu_load_15m_max})."
      }
    },
  ]
}
