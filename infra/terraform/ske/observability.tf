# Ships container logs, pod and cluster metrics and Kubernetes events to STACKIT Observability.
# otel-collector (DaemonSet) reads each node's log files and kubelet; otel-collector-cluster (one
# replica) reads the Kubernetes API, so events and cluster metrics are sent only once.

locals {
  observability_project_id = coalesce(var.observability_project_id, var.project_id)

  log_namespaces = concat(keys(var.namespaces), ["envoy-gateway-system", "cert-manager"])

  # otlphttp appends /v1/logs itself.
  otlp_logs_endpoint = trimsuffix(trimsuffix(data.stackit_observability_instance.this.otlp_http_logs_url, "/"), "/v1/logs")

  otel_common_values = {
    image = {
      # renovate: datasource=docker depName=otel/opentelemetry-collector-contrib
      repository = "otel/opentelemetry-collector-contrib"
      tag        = "0.161.0"
      digest     = "sha256:fd328de2552466ad78385e1b1289c3f2402b1c45f265b252aab1955b42845ac1"
    }

    # Nothing listens; the defaults would open receiver ports on every node.
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
      # Resource attributes become labels (k8s_namespace_name, k8s_pod_name, …).
      resource_to_telemetry_conversion = { enabled = true }
    })
  }

  otel_processors = {
    memory_limiter = {
      check_interval         = "5s"
      limit_percentage       = 80
      spike_limit_percentage = 25
    }

    # The dashboard and alert rules select on source="ske".
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

# Revocable on its own. Like every instance credential, it can also read all logs on the instance.
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
  version    = "0.174.0" # same version in both releases
  namespace  = kubernetes_namespace_v1.observability.metadata[0].name

  values = [yamlencode(merge(local.otel_common_values, {
    mode = "daemonset"

    presets = {
      logsCollection = {
        enabled = true
        # Keeps read offsets across restarts.
        storeCheckpoints = true
      }
      kubeletMetrics = {
        enabled = true
      }
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

    # Replaces the chart's default pipelines; the presets still add their receivers.
    alternateConfig = {
      extensions = local.otel_extensions
      exporters  = local.otel_exporters

      receivers = {
        # Gardener signs kubelet certs with a CA pods don't have; the traffic stays on the node.
        kubeletstats = {
          insecure_skip_verify = true
          collection_interval  = "30s"
        }
      }

      processors = merge(local.otel_processors, {
        # Keeps ingest within the plan's samples-per-minute limit. Add a metric here before
        # building a panel or alert on it.
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

        # /favicon?domain= lines pair the domains cited in a chat with the client IP. The quoted
        # field name can't be faked in a header value, where Envoy escapes quotes.
        "filter/favicon" = {
          error_mode = "ignore"
          logs = {
            log_record = [
              "resource.attributes[\"k8s.namespace.name\"] == \"envoy-gateway-system\" and IsMatch(body, \"\\\"x-envoy-origin-path\\\": ?\\\"/favicon[?]\")",
            ]
          }
        }

        # Becomes the Loki label service_name (ske-<namespace>).
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
            processors = ["memory_limiter", "filter/namespaces", "filter/favicon", "transform/service-name", "batch"]
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
  version    = "0.174.0" # same version in both releases
  namespace  = kubernetes_namespace_v1.observability.metadata[0].name

  values = [yamlencode(merge(local.otel_common_values, {
    mode         = "deployment"
    replicaCount = 1
    # No ports, so no Service.
    service = { enabled = false }

    presets = {
      clusterMetrics = {
        enabled = true
      }
      # The API server keeps events only about an hour.
      kubernetesEvents = {
        enabled = true
      }
    }

    # Reads only the Kubernetes API: no root, no hostPath.
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
