# Ships container logs, pod/container metrics, cluster state metrics and Kubernetes events to
# the STACKIT Observability instance — same instance and transports as the Supabase VMs
# (infra/supabase/otel-config.yml). The SKE observability extension (cluster.tf) only covers
# kube-system + node metrics.
#
# Two collectors from the same chart:
# - otel-collector (DaemonSet): per-node data — container log files and the node's kubelet stats.
# - otel-collector-cluster (Deployment, 1 replica): cluster-wide data read from the Kubernetes
#   API. One replica only; in the DaemonSet every node would ship each event and metric again.

locals {
  observability_project_id = coalesce(var.observability_project_id, var.project_id)

  # Envoy (access logs) and cert-manager (certificate renewals) next to the app namespaces.
  log_namespaces = concat(keys(var.namespaces), ["envoy-gateway-system", "cert-manager"])

  # The provider doesn't document whether otlp_http_logs_url includes /v1/logs; otlphttp's
  # `endpoint` appends it, so strip it if present.
  otlp_logs_endpoint = trimsuffix(trimsuffix(data.stackit_observability_instance.this.otlp_http_logs_url, "/"), "/v1/logs")

  # Values shared by both releases.
  otel_common_values = {
    image = {
      # renovate: datasource=docker depName=otel/opentelemetry-collector-contrib
      repository = "otel/opentelemetry-collector-contrib"
      tag        = "0.161.0"
      digest     = "sha256:fd328de2552466ad78385e1b1289c3f2402b1c45f265b252aab1955b42845ac1"
    }

    # Receive nothing over the network; the defaults would open OTLP/Jaeger/Zipkin ports
    # (hostPorts on every node in DaemonSet mode).
    ports = {
      otlp             = { enabled = false }
      "otlp-http"      = { enabled = false }
      "jaeger-compact" = { enabled = false }
      "jaeger-thrift"  = { enabled = false }
      "jaeger-grpc"    = { enabled = false }
      zipkin           = { enabled = false }
      metrics          = { enabled = false }
    }

    resources = {
      requests = { cpu = "50m", memory = "128Mi" }
      limits   = { memory = "256Mi" }
    }

    extraEnvs = [
      for key in ["username", "password"] : {
        name = "STACKIT_OBSERVABILITY_${upper(key)}"
        valueFrom = {
          secretKeyRef = {
            name = kubernetes_secret_v1.otel_collector_stackit.metadata[0].name
            key  = key
          }
        }
      }
    ]
  }

  otel_extensions = {
    health_check = { endpoint = "$${env:MY_POD_IP}:13133" }
    "basicauth/stackit" = {
      client_auth = {
        username = "$${env:STACKIT_OBSERVABILITY_USERNAME}"
        password = "$${env:STACKIT_OBSERVABILITY_PASSWORD}"
      }
    }
  }

  otel_retry = {
    retry_on_failure = {
      enabled          = true
      initial_interval = "5s"
      max_interval     = "30s"
      max_elapsed_time = "300s"
    }
  }

  otel_exporters = {
    "otlphttp/stackit" = merge(local.otel_retry, {
      endpoint      = local.otlp_logs_endpoint
      auth          = { authenticator = "basicauth/stackit" }
      sending_queue = { enabled = true, num_consumers = 2, queue_size = 1000 }
    })
    "prometheusremotewrite/stackit" = merge(local.otel_retry, {
      endpoint = data.stackit_observability_instance.this.metrics_push_url
      auth     = { authenticator = "basicauth/stackit" }
      # Turns resource attributes (k8s.namespace.name, k8s.pod.name, …) into labels
      # (k8s_namespace_name, k8s_pod_name, …); without it metrics can't be split per pod.
      resource_to_telemetry_conversion = { enabled = true }
    })
  }

  otel_processors = {
    memory_limiter = {
      check_interval         = "5s"
      limit_percentage       = 80
      spike_limit_percentage = 25
    }

    # Load-bearing: every SKE metric carries source="ske", which the dashboard and alert
    # rules select on (Supabase VMs use source="supabase-<env>").
    "resource/source" = {
      attributes = [{ key = "source", value = "ske", action = "upsert" }]
    }

    batch = {
      timeout         = "10s"
      send_batch_size = 1024
    }
  }
}

data "stackit_observability_instance" "this" {
  project_id  = local.observability_project_id
  instance_id = var.observability_instance_id
}

# Dedicated so it can be revoked on its own. Instance credentials can also query every log
# on the instance (incl. Supabase auth), so treat the Secret below as read access too.
resource "stackit_observability_credential" "otel_collector" {
  project_id  = local.observability_project_id
  instance_id = var.observability_instance_id
  description = "SKE ${var.cluster_name} otel-collector (logs push)"
}

resource "kubernetes_namespace_v1" "observability" {
  metadata {
    name = "observability"
    # Reading /var/log/pods needs hostPath, which both baseline and restricted forbid.
    labels = {
      "pod-security.kubernetes.io/enforce" = "privileged"
    }
  }
}

resource "kubernetes_secret_v1" "otel_collector_stackit" {
  metadata {
    name      = "otel-collector-stackit"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }

  data = {
    username = stackit_observability_credential.otel_collector.username
    password = stackit_observability_credential.otel_collector.password
  }
}

resource "helm_release" "otel_collector" {
  name       = "otel-collector"
  repository = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart      = "opentelemetry-collector"
  version    = "0.174.0" # keep both otel releases on the same version; Renovate updates them together
  namespace  = kubernetes_namespace_v1.observability.metadata[0].name

  values = [yamlencode(merge(local.otel_common_values, {
    mode = "daemonset"

    presets = {
      # Adds the filelog receiver over /var/log/pods and the hostPath mounts.
      logsCollection = {
        enabled = true
        # Remembers file offsets on the node, so a collector restart neither drops nor
        # re-sends lines.
        storeCheckpoints = true
      }
      # Pod/container CPU, memory, network and volume usage from this node's kubelet.
      kubeletMetrics = {
        enabled = true
      }
      # Adds deployment/node names to each record (ClusterRole: read pods/namespaces/replicasets).
      kubernetesAttributes = {
        enabled = true
      }
    }

    # Log files under /var/log/pods are root-owned and not world-readable.
    securityContext = {
      runAsUser                = 0
      runAsGroup               = 0
      allowPrivilegeEscalation = false
      readOnlyRootFilesystem   = true
      capabilities             = { drop = ["ALL"] }
    }

    # Replaces the chart's default config (OTLP/Jaeger/Zipkin receivers, debug exporter);
    # the presets above still add their receivers and processor to the pipelines.
    alternateConfig = {
      extensions = local.otel_extensions
      exporters  = local.otel_exporters

      receivers = {
        # SKE (Gardener) signs kubelet serving certs with a CA that isn't the cluster CA pods
        # get, so verification fails with "unknown authority". Traffic is pod -> own node only.
        kubeletstats = {
          insecure_skip_verify = true
          collection_interval  = "30s"
        }
      }

      processors = merge(local.otel_processors, {
        # The Observability plan caps ingest in samples/min (shared with the Supabase VMs and
        # Render); the full kubelet set at 20s exceeded the Starter plan. Keep what the
        # dashboard and alerts use, plus pod network and disk.
        "filter/kubelet-metrics" = {
          error_mode = "ignore"
          metrics = {
            metric = [
              "not IsMatch(name, \"^(container.cpu.usage|container.memory.working_set|container.memory.rss|k8s.pod.network.io|k8s.pod.network.errors|k8s.pod.filesystem.usage|k8s.node.cpu.usage|k8s.node.memory.working_set|k8s.node.memory.available|k8s.node.filesystem.usage|k8s.node.filesystem.capacity)$\")",
            ]
          }
        }

        "filter/namespaces" = {
          error_mode = "ignore"
          logs = {
            log_record = [
              "not IsMatch(resource.attributes[\"k8s.namespace.name\"], \"^(${join("|", local.log_namespaces)})$\")",
            ]
          }
        }

        # Load-bearing: service.name becomes the Loki stream label `service_name`
        # (ske-<namespace>, e.g. ske-prod), which queries and log alerts select on.
        "transform/service-name" = {
          error_mode = "ignore"
          log_statements = [{
            context    = "resource"
            statements = ["set(attributes[\"service.name\"], Concat([\"ske\", attributes[\"k8s.namespace.name\"]], \"-\"))"]
          }]
        }
      })

      service = {
        extensions = ["health_check", "basicauth/stackit"]
        pipelines = {
          logs = {
            receivers  = []
            processors = ["memory_limiter", "filter/namespaces", "transform/service-name", "batch"]
            exporters  = ["otlphttp/stackit"]
          }
          metrics = {
            receivers  = []
            processors = ["memory_limiter", "filter/kubelet-metrics", "resource/source", "batch"]
            exporters  = ["prometheusremotewrite/stackit"]
          }
        }
      }
    }
  }))]

  depends_on = [stackit_ske_cluster.this]
}

resource "helm_release" "otel_collector_cluster" {
  name       = "otel-collector-cluster"
  repository = "https://open-telemetry.github.io/opentelemetry-helm-charts"
  chart      = "opentelemetry-collector"
  version    = "0.174.0" # keep both otel releases on the same version; Renovate updates them together
  namespace  = kubernetes_namespace_v1.observability.metadata[0].name

  values = [yamlencode(merge(local.otel_common_values, {
    mode         = "deployment"
    replicaCount = 1
    # Deployment mode creates a Service by default; with every port disabled it would have none.
    service = { enabled = false }

    presets = {
      # Deployment/pod/container state from the API: desired vs. available replicas, restarts,
      # pod phase, container requests/limits, ResourceQuota usage.
      clusterMetrics = {
        enabled = true
      }
      # Kubernetes events (evictions, failed scheduling, probe failures) as log records; the
      # API server only keeps them for about an hour.
      kubernetesEvents = {
        enabled = true
      }
    }

    # Reads only the Kubernetes API, so unlike the DaemonSet it needs neither root nor hostPath.
    securityContext = {
      runAsNonRoot             = true
      allowPrivilegeEscalation = false
      readOnlyRootFilesystem   = true
      capabilities             = { drop = ["ALL"] }
      seccompProfile           = { type = "RuntimeDefault" }
    }

    alternateConfig = {
      extensions = local.otel_extensions
      exporters  = local.otel_exporters

      receivers = {
        # Merged into the preset's receiver; its 10s default costs 6x the samples.
        k8s_cluster = { collection_interval = "60s" }
      }

      processors = merge(local.otel_processors, {
        # Events from every namespace share one Loki stream; filter by namespace in the query.
        "resource/events" = {
          attributes = [{ key = "service.name", value = "ske-events", action = "upsert" }]
        }
      })

      service = {
        extensions = ["health_check", "basicauth/stackit"]
        pipelines = {
          logs = {
            receivers  = []
            processors = ["memory_limiter", "resource/events", "batch"]
            exporters  = ["otlphttp/stackit"]
          }
          metrics = {
            receivers  = []
            processors = ["memory_limiter", "resource/source", "batch"]
            exporters  = ["prometheusremotewrite/stackit"]
          }
        }
      }
    }
  }))]

  depends_on = [stackit_ske_cluster.this]
}
