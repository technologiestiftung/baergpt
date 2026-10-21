# Alert rules over the SKE cluster's telemetry (infra/terraform/ske/observability.tf): metrics
# carry source="ske", logs and events arrive as service_name="ske-<namespace>" / "ske-events".
#
# One cluster serves every environment and ships to the same Observability instance as both
# Supabase VMs, so these groups are created once, from the production workspace.
# Sandbox is left out on purpose: alerts about the test environment would train people to
# ignore the emails. Per-namespace rules set severity from the namespace (prod critical,
# staging warning) instead of duplicating every rule.

locals {
  ske_alerts_enabled = var.env == "production"

  ske_alert_namespaces = "prod|staging"

  # Wraps a PromQL expression whose series carry k8s_namespace_name.
  ske_severity_by_namespace = {
    prefix = "label_replace(label_replace("
    suffix = ", \"severity\", \"critical\", \"k8s_namespace_name\", \"prod\"), \"severity\", \"warning\", \"k8s_namespace_name\", \"staging\")"
  }

  # Same thresholds as KongHigh5xxRate: a share of traffic, with a floor of errors so a lone
  # failure at night doesn't page anyone.
  ske_5xx_ratio_max     = 0.20
  ske_5xx_min_errors_5m = 5

  # One 5xx rule per namespace: STACKIT caps a log rule's expression at 600 characters,
  # too short for the severity-by-namespace wrapper the metric rules use.
  ske_5xx_severity = { prod = "critical", staging = "warning" }
}

resource "stackit_observability_alertgroup" "ske" {
  count = local.ske_alerts_enabled ? 1 : 0

  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "ske"
  interval    = "60s"

  rules = [
    # --- Can users use the API? -----------------------------------------------------
    {
      alert = "SkeDeploymentUnavailable"
      expression = trimspace(<<-EOT
        ${local.ske_severity_by_namespace.prefix}
          max by (k8s_namespace_name, k8s_deployment_name) (k8s_deployment_desired{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"})
            - max by (k8s_namespace_name, k8s_deployment_name) (k8s_deployment_available{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"})
            > 0
        ${local.ske_severity_by_namespace.suffix}
      EOT
      )
      for    = "10m"
      labels = { source = "ske" }
      annotations = {
        summary     = "{{ $labels.k8s_namespace_name }}/{{ $labels.k8s_deployment_name }} is missing replicas"
        description = "{{ $value }} replica(s) have not been ready for 10m. Check the SKE dashboard's Warning events and the pods' logs ({service_name=\"ske-{{ $labels.k8s_namespace_name }}\"})."
      }
    },

    # --- What's about to break? -----------------------------------------------------
    {
      alert = "SkeContainerMemoryHigh"
      expression = trimspace(<<-EOT
        ${local.ske_severity_by_namespace.prefix}
          max by (k8s_namespace_name, k8s_pod_name, k8s_container_name) (container_memory_working_set_bytes{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"})
            / max by (k8s_namespace_name, k8s_pod_name, k8s_container_name) (k8s_container_memory_limit_bytes{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"})
            > 0.9
        ${local.ske_severity_by_namespace.suffix}
      EOT
      )
      for    = "2m"
      labels = { source = "ske" }
      annotations = {
        summary     = "{{ $labels.k8s_pod_name }}/{{ $labels.k8s_container_name }} is near its memory limit"
        description = "At {{ $value | humanizePercentage }} of its limit; the container is OOM-killed at 100%, which drops every request in flight on that pod."
      }
    },
    {
      alert = "SkeContainerRestarted"
      expression = trimspace(<<-EOT
        ${local.ske_severity_by_namespace.prefix}
          max by (k8s_namespace_name, k8s_pod_name, k8s_container_name) (
            max_over_time(k8s_container_restarts{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"}[15m])
              - min_over_time(k8s_container_restarts{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"}[15m])
          ) > 0
        ${local.ske_severity_by_namespace.suffix}
      EOT
      )
      for    = "0s"
      labels = { source = "ske" }
      annotations = {
        summary     = "{{ $labels.k8s_pod_name }}/{{ $labels.k8s_container_name }} restarted"
        description = "{{ $value }} restart(s) in the last 15m (crash or OOM kill). Check the Warning events ({service_name=\"ske-events\"}) and the pod's logs."
      }
    },
    {
      alert = "SkeQuotaNearlyFull"
      expression = trimspace(<<-EOT
        ${local.ske_severity_by_namespace.prefix}
          sum by (k8s_namespace_name, resource) (k8s_resource_quota_used{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"})
            / sum by (k8s_namespace_name, resource) (k8s_resource_quota_hard_limit{source="ske", k8s_namespace_name=~"${local.ske_alert_namespaces}"})
            > 0.9
        ${local.ske_severity_by_namespace.suffix}
      EOT
      )
      # Longer than a rollout, which briefly adds one surge pod per Deployment.
      for    = "15m"
      labels = { source = "ske" }
      annotations = {
        summary     = "{{ $labels.k8s_namespace_name }} quota {{ $labels.resource }} is nearly used up"
        description = "At {{ $value | humanizePercentage }} of the ResourceQuota (var.namespaces in infra/terraform/ske). The next rollout's extra pod may be rejected and the deploy stall."
      }
    },
    {
      alert = "SkeNodeDiskHigh"
      expression = trimspace(<<-EOT
        max by (k8s_node_name) (k8s_node_filesystem_usage_bytes{source="ske"})
          / max by (k8s_node_name) (k8s_node_filesystem_capacity_bytes{source="ske"})
          > 0.85
      EOT
      )
      for = "15m"
      labels = {
        severity = "warning"
        source   = "ske"
      }
      annotations = {
        summary     = "SKE node {{ $labels.k8s_node_name }} disk above 85%"
        description = "At {{ $value | humanizePercentage }}. A full node disk makes the kubelet evict pods, prod included, since all environments share the nodes."
      }
    },
    {
      alert = "SkeCertificateExpiresSoon"
      expression = trimspace(<<-EOT
        min by (name) (certmanager_certificate_expiration_timestamp_seconds{source="ske"}) - time() < 14 * 24 * 3600
      EOT
      )
      for = "0s"
      labels = {
        severity = "critical"
        source   = "ske"
      }
      annotations = {
        summary     = "TLS certificate {{ $labels.name }} expires in under 14 days"
        description = "Renewal starts 30 days before expiry, so it has failed for over 2 weeks. Check kubectl -n gateway describe certificate {{ $labels.name }} and {service_name=\"ske-cert-manager\"}."
      }
    },

    # --- Are we blind? ----------------------------------------------------------------
    # The push pipeline has no `up` metric, so absence of an always-present series is the
    # signal; absent_over_time's window is the delay, hence for = "0s".
    {
      alert = "SkeClusterTelemetryMissing"
      expression = trimspace(<<-EOT
        absent_over_time(k8s_container_ready{source="ske", k8s_namespace_name="observability"}[10m])
      EOT
      )
      for = "0s"
      labels = {
        severity = "critical"
        source   = "ske"
      }
      annotations = {
        summary     = "No cluster metrics from SKE for 10m"
        description = "The otel-collector-cluster pod (namespace observability) or the whole cluster stopped reporting. Every other SKE alert may be blind too."
      }
    },
    {
      alert = "SkeNodeTelemetryMissing"
      expression = trimspace(<<-EOT
        absent_over_time(container_memory_working_set_bytes{source="ske"}[10m])
      EOT
      )
      for = "0s"
      labels = {
        severity = "critical"
        source   = "ske"
      }
      annotations = {
        summary     = "No container metrics from SKE nodes for 10m"
        description = "None of the otel-collector agent pods deliver kubelet stats. Check kubectl -n observability logs -l app.kubernetes.io/instance=otel-collector --tail=-1."
      }
    },
    {
      alert = "SkeCollectorNotReady"
      expression = trimspace(<<-EOT
        sum(k8s_container_ready{source="ske", k8s_namespace_name="observability"})
          < count(k8s_container_ready{source="ske", k8s_namespace_name="observability"})
      EOT
      )
      for = "10m"
      labels = {
        severity = "warning"
        source   = "ske"
      }
      annotations = {
        summary     = "An SKE telemetry collector is not ready"
        description = "Only {{ $value }} collector container(s) are ready; logs and metrics from some node may be missing."
      }
    },
    {
      alert = "SkeCertificateMetricsMissing"
      expression = trimspace(<<-EOT
        absent_over_time(certmanager_certificate_expiration_timestamp_seconds{source="ske"}[30m])
      EOT
      )
      for = "0s"
      labels = {
        severity = "warning"
        source   = "ske"
      }
      annotations = {
        summary     = "No certificate expiry data from SKE for 30m"
        description = "otel-collector-cluster no longer scrapes cert-manager (prometheus/cert-manager receiver), so SkeCertificateExpiresSoon can't fire."
      }
    },
  ]
}

# LogQL rules over Envoy's access log and the Kubernetes events. LogQL unquotes Go-style
# escapes inside strings; HCL heredocs pass the text through verbatim.
resource "stackit_observability_logalertgroup" "ske" {
  count = local.ske_alerts_enabled ? 1 : 0

  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "ske-logs"
  interval    = "60s"

  rules = concat(
    # route_name is httproute/<namespace>/<route>/…; lines without a route (scanners hitting
    # the IP with unknown hostnames) and the HTTP->HTTPS redirect don't match.
    [for ns, severity in local.ske_5xx_severity : {
      alert = "SkeEnvoy5xxRateHigh"
      expression = trimspace(<<-EOT
        sum by (route_name) (count_over_time({service_name="ske-envoy-gateway-system"} | json | route_name=~"httproute/${ns}/.+" | response_code >= 500 [5m]))
          / sum by (route_name) (count_over_time({service_name="ske-envoy-gateway-system"} | json | route_name=~"httproute/${ns}/.+" [5m]))
          > ${local.ske_5xx_ratio_max}
        and
        sum by (route_name) (count_over_time({service_name="ske-envoy-gateway-system"} | json | route_name=~"httproute/${ns}/.+" | response_code >= 500 [5m]))
          >= ${local.ske_5xx_min_errors_5m}
      EOT
      )
      for = "2m"
      labels = {
        severity = severity
        source   = "ske"
      }
      annotations = {
        summary     = "Envoy 5xx above ${local.ske_5xx_ratio_max} of requests on {{ $labels.route_name }}"
        description = "{{ $value | humanizePercentage }} of requests got a 5xx over 5m (503: no ready pod, 504: timeout). Logs: {service_name=\"ske-envoy-gateway-system\"} and the backend's."
      }
    }],
    [
      {
        alert = "SkePodsRejectedOrEvicted"
        expression = trimspace(<<-EOT
          label_replace(label_replace(
            sum by (object_regarding_namespace, object_reason) (count_over_time(
              {service_name="ske-events"}
                | json
                | object_type="Warning"
                | object_reason=~"FailedCreate|FailedScheduling|Evicted"
                | object_regarding_namespace=~"${local.ske_alert_namespaces}"
              [10m]
            )) > 0,
          "severity", "critical", "object_regarding_namespace", "prod"), "severity", "warning", "object_regarding_namespace", "staging")
        EOT
        )
        for    = "0s"
        labels = { source = "ske" }
        annotations = {
          summary     = "{{ $labels.object_reason }} in {{ $labels.object_regarding_namespace }}"
          description = "{{ $value }} {{ $labels.object_reason }} event(s) in 10m: quota full, no node with room, or evictions. Logs: {service_name=\"ske-events\"} | json | object_reason=\"{{ $labels.object_reason }}\""
        }
      },
    ],
  )
}
