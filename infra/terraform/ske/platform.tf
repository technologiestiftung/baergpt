# Cluster-wide platform layer, installed through the kubernetes/helm providers in provider.tf.

# Gateway API controller. The chart also installs the Gateway API CRDs, so it comes before
# anything that uses those kinds.
resource "helm_release" "envoy_gateway" {
  name             = "envoy-gateway"
  chart            = "oci://docker.io/envoyproxy/gateway-helm"
  version          = "v1.9.2" # supports k8s 1.33–1.36
  namespace        = "envoy-gateway-system"
  create_namespace = true

  depends_on = [stackit_ske_cluster.this]
}

# The chart doesn't create a GatewayClass.
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
  version          = "v1.21.2" # supports k8s 1.33–1.36
  namespace        = "cert-manager"
  create_namespace = true

  set = [
    {
      name  = "crds.enabled"
      value = "true"
    },
    # Certificates for Gateway listeners; off by default and needs the Gateway API CRDs.
    {
      name  = "config.gatewayAPI.enabled"
      value = "true"
    },
  ]

  depends_on = [stackit_ske_cluster.this, helm_release.envoy_gateway]
}

# kubernetes_manifest checks its kind against the live cluster at plan time, so a new cluster
# needs the staged first apply (README).
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
        # ACME validates over plain HTTP, before any certificate exists.
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

# One Gateway for all environments: each Gateway gets its own load balancer and public IP.
resource "kubernetes_namespace_v1" "gateway" {
  metadata {
    name = "gateway"
  }
}

# Separate from the load balancer, so the IP survives the Envoy Service being recreated.
resource "stackit_public_ip" "gateway" {
  project_id = var.project_id

  lifecycle {
    # Set by the load balancer when it attaches the IP.
    ignore_changes = [network_interface_id, labels]
    # A released IP can go to another customer while DNS still points at it.
    prevent_destroy = true
  }
}

# Settings for the LoadBalancer Service that Envoy Gateway creates.
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
              # Only applied when the Service is created.
              "lb.stackit.cloud/external-address" = stackit_public_ip.gateway.ip
              # Passes the client IP to Envoy; must match proxyProtocol in client_traffic_policy.
              "lb.stackit.cloud/tcp-proxy-protocol" = "true"
              # In-cluster calls to the LB IP (cert-manager's self-check) also go through the LB.
              "lb.stackit.cloud/ip-mode-proxy" = "true"
            }
            # The default, Local, isn't supported by STACKIT's load balancer.
            externalTrafficPolicy = "Cluster"
          }
        }
      }
    }
  }

  depends_on = [helm_release.envoy_gateway]
}

resource "kubernetes_manifest" "client_traffic_policy" {
  manifest = {
    apiVersion = "gateway.envoyproxy.io/v1alpha1"
    kind       = "ClientTrafficPolicy"
    metadata = {
      name      = "baergpt"
      namespace = kubernetes_namespace_v1.gateway.metadata[0].name
    }
    spec = {
      targetRefs = [{
        group = "gateway.networking.k8s.io"
        kind  = "Gateway"
        name  = kubernetes_manifest.gateway.manifest.metadata.name
      }]
      # If the header ever goes missing, only the client IPs are lost, not the API.
      proxyProtocol = {
        optional = true
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
        # cert-manager issues one certificate per HTTPS listener.
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
        # Only for ACME challenges and the HTTPS redirect, both in this namespace.
        [{
          name     = "http"
          protocol = "HTTP"
          port     = 80
          allowedRoutes = {
            namespaces = { from = "Same" }
          }
        }],
        # One listener and certificate per hostname: HTTP-01 can't issue wildcards.
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
            # Only the environment's own namespace, so sandbox can't claim the prod hostname.
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

# cert-manager's Exact-path challenge routes take precedence over this catch-all.
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

resource "kubernetes_namespace_v1" "envs" {
  for_each = var.namespaces

  metadata {
    name = each.key
    # Pod Security defaults to privileged without these; the deployer can't edit namespaces.
    labels = {
      "pod-security.kubernetes.io/enforce"         = "restricted"
      "pod-security.kubernetes.io/enforce-version" = "latest"
      "pod-security.kubernetes.io/warn"            = "restricted"
      "pod-security.kubernetes.io/warn-version"    = "latest"
      "pod-security.kubernetes.io/audit"           = "restricted"
      "pod-security.kubernetes.io/audit-version"   = "latest"
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
    # No limits.cpu: it would reject every pod without a CPU limit, and ours set requests only.
    hard = {
      "requests.cpu"    = each.value.quota_cpu
      "requests.memory" = each.value.quota_memory
      "limits.memory"   = each.value.quota_memory
      "pods"            = each.value.quota_pods
    }
  }
}

# Same-namespace ingress only; the app NetworkPolicies in infra/k8s open the rest.
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
        pod_selector {}
      }
    }
  }
}

# The deployer may create Services. Only ClusterIP without externalIPs is admitted: externalIPs
# can intercept traffic to any IP, NodePort/LoadBalancer would bypass the Gateway.
resource "kubernetes_manifest" "env_services_cluster_ip_only" {
  manifest = {
    apiVersion = "admissionregistration.k8s.io/v1"
    kind       = "ValidatingAdmissionPolicy"
    metadata = {
      name = "env-services-cluster-ip-only"
    }
    spec = {
      failurePolicy = "Fail"
      matchConstraints = {
        resourceRules = [{
          apiGroups   = [""]
          apiVersions = ["v1"]
          operations  = ["CREATE", "UPDATE"]
          resources   = ["services"]
        }]
      }
      validations = [
        {
          expression = "!has(object.spec.externalIPs) || size(object.spec.externalIPs) == 0"
          message    = "spec.externalIPs is not allowed in environment namespaces."
        },
        {
          expression = "!has(object.spec.type) || object.spec.type == 'ClusterIP'"
          message    = "Only ClusterIP Services are allowed in environment namespaces; public traffic goes through the shared Gateway."
        },
      ]
    }
  }
}

resource "kubernetes_manifest" "env_services_cluster_ip_only_binding" {
  manifest = {
    apiVersion = "admissionregistration.k8s.io/v1"
    kind       = "ValidatingAdmissionPolicyBinding"
    metadata = {
      name = "env-services-cluster-ip-only"
    }
    spec = {
      policyName        = kubernetes_manifest.env_services_cluster_ip_only.manifest.metadata.name
      validationActions = ["Deny"]
      matchResources = {
        namespaceSelector = {
          matchExpressions = [{
            key      = "kubernetes.io/metadata.name"
            operator = "In"
            values   = keys(var.namespaces)
          }]
        }
      }
    }
  }
}
