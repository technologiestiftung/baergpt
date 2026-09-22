# Phase 2 — cluster platform layer. Installed once, cluster-wide, via the kubernetes/
# helm providers wired in provider.tf (fed from stackit_ske_kubeconfig).

# Gateway API implementation. Deliberately NOT ingress-nginx: that project was retired
# on 2026-03-24 and receives no further releases or security fixes. Envoy Gateway is the
# controller STACKIT documents for SKE, and Gateway API is the upstream successor to the
# Ingress API.
#
# The chart ships the Gateway API CRDs (gateway.networking.k8s.io) as well as its own, so
# it must be installed before anything that references those kinds.
resource "helm_release" "envoy_gateway" {
  name             = "envoy-gateway"
  chart            = "oci://docker.io/envoyproxy/gateway-helm"
  version          = "v1.9.1" # verify for a newer release before bumping
  namespace        = "envoy-gateway-system"
  create_namespace = true

  depends_on = [stackit_ske_cluster.this]
}

# Binds our Gateways to the Envoy Gateway controller. Not shipped by the chart.
resource "kubernetes_manifest" "gateway_class" {
  manifest = {
    apiVersion = "gateway.networking.k8s.io/v1"
    kind       = "GatewayClass"
    metadata = {
      name = "eg"
    }
    spec = {
      controllerName = "gateway.envoyproxy.io/gatewayclass-controller"
    }
  }

  depends_on = [helm_release.envoy_gateway]
}

resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = "v1.21.2" # verify for a newer release before bumping
  namespace        = "cert-manager"
  create_namespace = true

  set = [
    {
      name  = "crds.enabled"
      value = "true"
    },
    # Lets cert-manager solve ACME challenges through HTTPRoutes and issue certificates
    # for Gateway listeners. Beta since cert-manager 1.15 — no feature gate needed, but
    # it is off by default. Requires the Gateway API CRDs to already exist, hence the
    # dependency on the Envoy Gateway chart below.
    {
      name  = "config.gatewayAPI.enabled"
      value = "true"
    },
  ]

  depends_on = [stackit_ske_cluster.this, helm_release.envoy_gateway]
}

# Let's Encrypt HTTP-01 issuer. Staging LE first in practice (swap the server URL)
# to avoid hitting LE's production rate limits while testing ingress + DNS.
#
# NOTE: `kubernetes_manifest` validates the kind against the live API server at PLAN
# time, and `depends_on` does not defer that — so on a cluster where cert-manager's
# CRDs don't exist yet, `terraform plan` fails with "no matches for kind ClusterIssuer".
# The first apply is therefore staged; see the README's "First apply is staged".
resource "kubernetes_manifest" "cluster_issuer" {
  manifest = {
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name = "letsencrypt"
    }
    spec = {
      acme = {
        email  = var.letsencrypt_email
        server = var.letsencrypt_acme_server
        privateKeySecretRef = {
          name = "letsencrypt-account-key"
        }
        # The solver attaches its challenge HTTPRoute to the shared Gateway's plain
        # HTTP listener; ACME validates over port 80 before any certificate exists.
        solvers = [{
          http01 = {
            gatewayHTTPRoute = {
              parentRefs = [{
                name        = kubernetes_manifest.gateway.manifest.metadata.name
                namespace   = kubernetes_manifest.gateway.manifest.metadata.namespace
                kind        = "Gateway"
                sectionName = "http"
              }]
            }
          }
        }]
      }
    }
  }

  depends_on = [helm_release.cert_manager]
}

# One shared Gateway for every environment, rather than one per namespace: each Gateway
# gets its own Envoy deployment and its own STACKIT load balancer (and therefore its own
# public IP and cost). Sharing keeps it to a single LB and a single IP for all three
# hostnames to point at — consistent with the single-cluster decision.
resource "kubernetes_namespace_v1" "gateway" {
  metadata {
    name = "gateway"
  }
}

resource "kubernetes_manifest" "gateway" {
  manifest = {
    apiVersion = "gateway.networking.k8s.io/v1"
    kind       = "Gateway"
    metadata = {
      name      = "baergpt"
      namespace = kubernetes_namespace_v1.gateway.metadata[0].name
      annotations = {
        # cert-manager's gateway-shim watches this annotation and issues a Certificate
        # per TLS listener, writing each Secret into this namespace.
        "cert-manager.io/cluster-issuer" = "letsencrypt"
      }
    }
    spec = {
      gatewayClassName = kubernetes_manifest.gateway_class.manifest.metadata.name
      listeners = concat(
        # Plain HTTP, kept open for ACME HTTP-01 challenges. Application traffic is
        # redirected to HTTPS by the apps' own HTTPRoutes.
        [{
          name     = "http"
          protocol = "HTTP"
          port     = 80
          allowedRoutes = {
            namespaces = { from = "All" }
          }
        }],
        # One TLS listener per environment. HTTP-01 cannot issue wildcards, so each
        # hostname needs its own listener and its own certificate.
        [for ns, cfg in var.namespaces : {
          name     = "https-${ns}"
          protocol = "HTTPS"
          port     = 443
          hostname = cfg.hostname
          tls = {
            mode = "Terminate"
            certificateRefs = [{
              kind = "Secret"
              name = "${ns}-tls"
            }]
          }
          allowedRoutes = {
            # Only the matching environment namespace may attach routes to its own
            # hostname, so a route in sandbox cannot claim the prod hostname.
            namespaces = {
              from = "Selector"
              selector = {
                matchLabels = {
                  "kubernetes.io/metadata.name" = ns
                }
              }
            }
          }
        }]
      )
    }
  }

  depends_on = [helm_release.cert_manager]
}

# staging/prod/sandbox as namespaces on the one cluster (see decision #1 in
# infra/K8S_MIGRATION_PLAN.md). ResourceQuota + default-deny NetworkPolicy are what
# keep one namespace's workload from starving another's on shared nodes.
resource "kubernetes_namespace_v1" "envs" {
  for_each = var.namespaces

  metadata {
    name = each.key
  }
}

resource "kubernetes_resource_quota_v1" "envs" {
  for_each = var.namespaces

  metadata {
    name      = "${each.key}-quota"
    namespace = kubernetes_namespace_v1.envs[each.key].metadata[0].name
  }

  spec {
    # No "limits.cpu": once a quota constrains it, every container must declare a CPU
    # limit or the pod is rejected outright. We deliberately set CPU *requests* only
    # (limits cause throttling), so constraining limits.cpu here would make every
    # Deployment unschedulable.
    hard = {
      "requests.cpu"    = each.value.quota_cpu
      "requests.memory" = each.value.quota_memory
      "limits.memory"   = each.value.quota_memory
      "pods"            = each.value.quota_pods
    }
  }
}

# Default-deny ingress from other namespaces; DNS + same-namespace traffic still
# works. Each app's own NetworkPolicy (Phase 3 manifests) opens what it actually needs
# (e.g. backend -> gotenberg within the same namespace).
resource "kubernetes_network_policy_v1" "default_deny_cross_namespace" {
  for_each = var.namespaces

  metadata {
    name      = "default-deny-cross-namespace"
    namespace = kubernetes_namespace_v1.envs[each.key].metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        pod_selector {} # same-namespace traffic only
      }
    }
  }
}

# GHCR pull credential, one per namespace (backend/gotenberg images are private).
resource "kubernetes_secret_v1" "ghcr_pull" {
  for_each = var.namespaces

  metadata {
    name      = "ghcr-pull-secret"
    namespace = kubernetes_namespace_v1.envs[each.key].metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "ghcr.io" = {
          username = var.ghcr_username
          password = var.ghcr_token
          auth     = base64encode("${var.ghcr_username}:${var.ghcr_token}")
        }
      }
    })
  }
}

# TODO: metrics-server — verify whether SKE ships it by default (common for managed
# k8s) before installing our own; HPA (Phase 3) needs it either way. If absent, add a
# helm_release here (chart: metrics-server/metrics-server).

# TODO: observability (OTel collector / Promtail + kube-state-metrics + node-exporter
# -> STACKIT Observability). Not scaffolded yet — the existing pattern in
# infra/supabase/otel-config.yml is a docker-compose/VM config, not a Helm values file,
# so this needs its own design pass (likely the opentelemetry-collector or
# grafana/k8s-monitoring chart) rather than a direct port. Do this before Phase 5
# staging cutover, since verifying logs in Observability is a cutover checklist item.
