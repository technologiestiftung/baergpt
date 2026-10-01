# Cluster platform layer. Installed once, cluster-wide, via the kubernetes/helm
# providers wired in provider.tf (fed from stackit_ske_kubeconfig).

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
  version          = "v1.9.2" # supports k8s 1.33–1.36; check the compatibility matrix before a cluster minor upgrade
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
  version          = "v1.21.2" # supports k8s 1.33–1.36; check supported releases before a cluster minor upgrade
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

# Static IP for the Gateway's load balancer, so it survives the Envoy Service being
# recreated and DNS (dns.tf) can point at it. STACKIT never deletes it on its own.
resource "stackit_public_ip" "gateway" {
  project_id = var.project_id

  lifecycle {
    # The load balancer attaches the IP to its own network interface and tracks it
    # through its own lb.stackit.cloud labels; Terraform must not strip either.
    ignore_changes = [network_interface_id, labels]
  }
}

# Envoy Gateway creates the LoadBalancer Service itself; this is the only way to set
# annotations on it.
resource "kubernetes_manifest" "envoy_proxy" {
  manifest = {
    apiVersion = "gateway.envoyproxy.io/v1alpha1"
    kind       = "EnvoyProxy"
    metadata = {
      name      = "baergpt"
      namespace = kubernetes_namespace_v1.gateway.metadata[0].name
    }
    spec = {
      provider = {
        type = "Kubernetes"
        kubernetes = {
          envoyService = {
            annotations = {
              # Only takes effect when the Service is created; on an existing Service
              # STACKIT accepts only the IP it already has.
              "lb.stackit.cloud/external-address" = stackit_public_ip.gateway.ip
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.envoy_gateway]
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
      infrastructure = {
        parametersRef = {
          group = "gateway.envoyproxy.io"
          kind  = "EnvoyProxy"
          name  = kubernetes_manifest.envoy_proxy.manifest.metadata.name
        }
      }
      listeners = concat(
        # Plain HTTP, kept open for ACME HTTP-01 challenges; everything else is
        # redirected to HTTPS (kubernetes_manifest.https_redirect). Only routes from the
        # gateway namespace may attach, where cert-manager creates its challenge routes,
        # so no app namespace can claim plain HTTP for another env's hostname.
        [{
          name     = "http"
          protocol = "HTTP"
          port     = 80
          allowedRoutes = {
            namespaces = { from = "Same" }
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

# cert-manager's challenge routes match an Exact path, which takes precedence over this
# catch-all, so HTTP-01 validation keeps working.
resource "kubernetes_manifest" "https_redirect" {
  manifest = {
    apiVersion = "gateway.networking.k8s.io/v1"
    kind       = "HTTPRoute"
    metadata = {
      name      = "https-redirect"
      namespace = kubernetes_namespace_v1.gateway.metadata[0].name
    }
    spec = {
      parentRefs = [{
        name        = kubernetes_manifest.gateway.manifest.metadata.name
        namespace   = kubernetes_manifest.gateway.manifest.metadata.namespace
        kind        = "Gateway"
        sectionName = "http"
      }]
      hostnames = [for ns, cfg in var.namespaces : cfg.hostname]
      rules = [{
        filters = [{
          type = "RequestRedirect"
          requestRedirect = {
            scheme     = "https"
            statusCode = 301
          }
        }]
      }]
    }
  }

  depends_on = [helm_release.envoy_gateway]
}

# staging/prod/sandbox as namespaces on the one cluster. ResourceQuota + default-deny
# NetworkPolicy keep one namespace's workload from starving or reaching another's.
resource "kubernetes_namespace_v1" "envs" {
  for_each = var.namespaces

  metadata {
    name = each.key
    # Without these, Pod Security defaults to "privileged" and a deployer could run a
    # privileged/hostPath pod on a node shared with prod. The deployer can't edit
    # namespaces, so it can't lift this. Bump the version deliberately with k8s upgrades.
    labels = {
      "pod-security.kubernetes.io/enforce"         = "restricted"
      "pod-security.kubernetes.io/enforce-version" = "v1.36"
      "pod-security.kubernetes.io/warn"            = "restricted"
      "pod-security.kubernetes.io/warn-version"    = "v1.36"
      "pod-security.kubernetes.io/audit"           = "restricted"
      "pod-security.kubernetes.io/audit-version"   = "v1.36"
    }
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
# works. Each app's own NetworkPolicy (infra/k8s) opens what it actually needs
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

# TODO: observability (OTel collector / Promtail + kube-state-metrics + node-exporter
# -> STACKIT Observability). Not scaffolded yet — the existing pattern in
# infra/supabase/otel-config.yml is a docker-compose/VM config, not a Helm values file,
# so this needs its own design pass (likely the opentelemetry-collector or
# grafana/k8s-monitoring chart) rather than a direct port. Needed before the staging
# cutover.
