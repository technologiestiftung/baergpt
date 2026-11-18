# Security alerts on the access logs of Kong (Supabase gateway), the Render backend and the
# SKE backend. They email on attack signatures and on scripts that got past authentication;
# failed scans don't alert.
#
# The Kong group exists in every workspace; the Render and SKE groups only in production.
# LogQL regexes are in backticks (raw strings): one backslash in heredocs, two in quoted locals.

locals {
  security_severity = var.env == "production" ? "critical" : "warning"

  # Null in staging, where no rule uses it. The production groups require it (see their preconditions).
  requests_per_ip_max = coalesce(var.security_requests_per_ip_max_5m, 0)

  kong_log    = "{service_name=\"${var.target_source}\"}"
  kong_fields = "| pattern `<_> - - [<_>] \"<method> <request> <_>\" <status> <_> \"<_>\" \"<ua>\"`"
  render_log  = "{source=\"render\", resource=\"${coalesce(var.render_backend_resource, "none")}\"}"

  browser_ua     = "`Mozilla/5\\.0 \\(.*\\).*(Firefox|Chrome|Safari)/.*`"
  metadata_hosts = "169\\.254\\.169\\.254|100\\.100\\.100\\.200|metadata\\.google"
  oast_re        = "`(?i)(oastify\\.com|burpcollaborator|oast\\.(fun|pro|live|site|online|me)|interact\\.sh|webhook\\.site|ngrok|requestbin|pipedream|dnslog\\.cn|ceye\\.io|bxss\\.me|canarytokens|${local.metadata_hosts})`"
  probe_path_re  = "`(?i)/(\\.env|\\.git/|_render|vars|_config|openapi\\.json|swagger|graphql|api-docs|whoami|debug|_debug|phpmyadmin|actuator|server-status).*`"

  security_kong_rules = [
    {
      alert = "SecurityPrivilegedRpcCalled"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.kong_log} |~ `"[A-Z]+ /rest/v1/rpc/update_user_(email_confirmed_at|last_sign_in_at)[?/ ]` [5m])) > 0
      EOT
      )
      summary     = "Test-only auth RPC called on ${var.target_source}"
      description = "update_user_email_confirmed_at or update_user_last_sign_in_at was called through the public API. Both are test helpers that write to auth.users. If the call got a 2xx, check auth.users."
    },
    {
      alert = "SecuritySchemaReturned"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.kong_log} ${local.kong_fields} | method="GET" | request=~`/rest/v1/?(\?.*)?` | status=~`2..` [5m])) > 0
      EOT
      )
      summary     = "Database API schema returned on ${var.target_source}"
      description = "GET /rest/v1/ was answered with the schema. Only the service-role key may do that: check whether the key leaked or the gateway rule for this route is missing."
    },
    # 2h window, so repeated attempts by one visitor send one email.
    {
      alert = "SecuritySchemaReadRefused"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.kong_log} ${local.kong_fields} | method="GET" | request=~`/rest/v1/?(\?.*)?` | status!~`401|2..` [2h])) > 0
      EOT
      )
      summary     = "Database API schema requested but not returned on ${var.target_source}"
      description = "GET /rest/v1/ got neither a 401 nor the schema. Usually a 403: a valid key that may not read it, so someone is exploring the API. See what else they requested in {service_name=\"${var.target_source}\"}."
      severity    = "warning"
    },
    {
      alert = "SecurityScriptObtainedSession"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.kong_log} ${local.kong_fields} | method!="OPTIONS" | request=~`/auth/v1/(token|verify).*` | status=~`2..` | ua!~${local.browser_ua} [5m])) > 0
      EOT
      )
      summary     = "Non-browser client got a session on ${var.target_source}"
      description = "A script (curl, python, ...) logged in or refreshed a session: an account is used outside the app. Find the account in {service_name=\"${var.target_source}-auth\"} at the same time."
    },
    {
      alert = "SecurityOastOrMetadataUrl"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.kong_log} |~ ${local.oast_re} [5m])) > 0
      EOT
      )
      summary     = "SSRF probe on ${var.target_source}"
      description = "A request contains a callback domain (oastify, interact.sh, ...) or a cloud-metadata address. Someone is testing whether our servers can be made to call it (SSRF)."
    },
    {
      alert = "SecurityProbePathAnswered"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.kong_log} ${local.kong_fields} | method!="OPTIONS" | request=~${local.probe_path_re} | status=~`2..` [5m])) > 0
      EOT
      )
      summary     = "Probe path answered 2xx on ${var.target_source}"
      description = "A path that scanners try (.env, .git, openapi.json, actuator, ...) was answered with a 2xx. Check what it returned: something may be exposed."
    },
  ]

  security_render_rules = [
    {
      alert = "SecurityScriptPastBackendAuth"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.render_log} | logfmt | method!="OPTIONS" | statusCode=~`2..` | path!~`/health.*` | userAgent!~${local.browser_ua} [5m])) > 0
      EOT
      )
      summary     = "Non-browser client got a 2xx from the backend (Render)"
      description = "A script sent a valid login token (JWT) and got an answer: an account is used outside the app. Find the request in {source=\"render\"} at the same time."
    },
    # The frontend calls /favicon?domain= for every source a chat cites; only metadata addresses count there.
    {
      alert = "SecurityOastOrMetadataUrl"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.render_log} | logfmt | statusCode!="" | path!~`/favicon\?.*` or path=~`(?i).*(${local.metadata_hosts}).*` | line_format `{{.path}} {{.userAgent}}` |~ ${local.oast_re} [5m])) > 0
      EOT
      )
      summary     = "SSRF probe on the backend (Render)"
      description = "A request's path or user agent contains a callback domain or a cloud-metadata address, e.g. /favicon?domain=169.254.169.254. Someone is testing for SSRF."
    },
    {
      alert = "SecurityProbePathAnswered"
      expression = trimspace(<<-EOT
        sum(count_over_time(${local.render_log} | logfmt | method!="OPTIONS" | statusCode=~`2..` | path=~${local.probe_path_re} [5m])) > 0
      EOT
      )
      summary     = "Probe path answered 2xx on the backend (Render)"
      description = "A path that scanners try was answered with a 2xx. Check what it returned: something may be exposed."
    },
    {
      alert = "SecurityRequestFloodFromIp"
      expression = trimspace(<<-EOT
        max(sum by (clientIP) (count_over_time(${local.render_log} | logfmt | clientIP!="" [5m]))) > ${local.requests_per_ip_max}
      EOT
      )
      summary     = "One client IP is flooding the backend (Render)"
      description = "{{ $value }} requests from one IP in 5 minutes: scraping or a flood. Group {source=\"render\"} by clientIP to find it. Logs arrive with a delay, so the alert can clear while a long flood continues."
    },
  ]

  security_envoy_rules = flatten([
    for ns, severity in local.ske_5xx_severity : [
      for r in concat(
        [
          {
            alert = "SecurityScriptPastBackendAuth"
            expression = trimspace(<<-EOT
              sum(count_over_time({service_name="ske-envoy-gateway-system"} |= `httproute/${ns}/backend/` | json | route_name=~`httproute/${ns}/backend/.*` | method!="OPTIONS" | response_code=~`2..` | x_envoy_origin_path!~`/health.*` | user_agent!~${local.browser_ua} [5m])) > 0
            EOT
            )
            summary     = "Non-browser client got a 2xx from the backend (SKE ${ns})"
            description = "A script sent a valid login token (JWT) and got an answer: an account is used outside the app. Find the request in {service_name=\"ske-envoy-gateway-system\"} |= \"httproute/${ns}/backend/\"."
          },
          {
            alert = "SecurityOastOrMetadataUrl"
            expression = trimspace(<<-EOT
              sum(count_over_time({service_name="ske-envoy-gateway-system"} |= `httproute/${ns}/backend/` |~ ${local.oast_re} | json | route_name=~`httproute/${ns}/backend/.*` [5m])) > 0
            EOT
            )
            summary     = "SSRF probe on the backend (SKE ${ns})"
            description = "A request contains a callback domain or a cloud-metadata address: someone is testing for SSRF. /favicon? requests are not logged on SKE."
          },
          {
            alert = "SecurityProbePathAnswered"
            expression = trimspace(<<-EOT
              sum(count_over_time({service_name="ske-envoy-gateway-system"} |= `httproute/${ns}/backend/` | json | route_name=~`httproute/${ns}/backend/.*` | method!="OPTIONS" | response_code=~`2..` | x_envoy_origin_path=~${local.probe_path_re} [5m])) > 0
            EOT
            )
            summary     = "Probe path answered 2xx on the backend (SKE ${ns})"
            description = "A path that scanners try was answered with a 2xx. Check what it returned: something may be exposed."
          },
        ],
        # Prod only: staging has too little traffic for a per-IP threshold.
        ns == "prod" ? [{
          alert = "SecurityRequestFloodFromIp"
          expression = trimspace(<<-EOT
            max(sum by (ip) (count_over_time({service_name="ske-envoy-gateway-system"} |= `httproute/${ns}/backend/` | json | route_name=~`httproute/${ns}/backend/.*` | label_format ip=`{{ regexReplaceAll ":[0-9]+$" .downstream_remote_address "" }}` [5m]))) > ${local.requests_per_ip_max}
          EOT
          )
          summary     = "One client IP is flooding the backend (SKE ${ns})"
          description = "{{ $value }} requests from one IP in 5 minutes: scraping or a flood. Group {service_name=\"ske-envoy-gateway-system\"} by downstream_remote_address to find it."
        }] : [],
      ) : merge(r, { severity = severity })
    ]
  ])
}

resource "stackit_observability_logalertgroup" "security_kong" {
  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "${var.env}-security-kong"
  interval    = "60s"

  rules = [for r in local.security_kong_rules : {
    alert      = r.alert
    expression = r.expression
    for        = "0s"
    labels = {
      severity = try(r.severity, local.security_severity)
      source   = var.target_source
    }
    annotations = {
      summary     = r.summary
      description = r.description
    }
  }]

  lifecycle {
    precondition {
      condition     = alltrue([for r in local.security_kong_rules : length(r.expression) <= 600])
      error_message = "A security_kong rule expression exceeds STACKIT's 600-character limit for log rules."
    }
  }
}

resource "stackit_observability_logalertgroup" "security_render" {
  count = var.env == "production" && var.render_backend_resource != null ? 1 : 0

  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "production-security-render"
  interval    = "60s"

  rules = [for r in local.security_render_rules : {
    alert      = r.alert
    expression = r.expression
    for        = "0s"
    labels = {
      severity = "critical"
      source   = "render"
    }
    annotations = {
      summary     = r.summary
      description = r.description
    }
  }]

  lifecycle {
    precondition {
      condition     = var.security_requests_per_ip_max_5m != null
      error_message = "Set security_requests_per_ip_max_5m in production.tfvars."
    }
    precondition {
      condition     = alltrue([for r in local.security_render_rules : length(r.expression) <= 600])
      error_message = "A security_render rule expression exceeds STACKIT's 600-character limit for log rules."
    }
  }
}

resource "stackit_observability_logalertgroup" "security_ske" {
  count = local.shared_alerts_enabled ? 1 : 0

  project_id  = var.project_id
  instance_id = var.instance_id
  name        = "ske-security"
  interval    = "60s"

  rules = [for r in local.security_envoy_rules : {
    alert      = r.alert
    expression = r.expression
    for        = "0s"
    labels = {
      severity = r.severity
      source   = "ske"
    }
    annotations = {
      summary     = r.summary
      description = r.description
    }
  }]

  lifecycle {
    precondition {
      condition     = var.security_requests_per_ip_max_5m != null
      error_message = "Set security_requests_per_ip_max_5m in production.tfvars."
    }
    precondition {
      condition     = alltrue([for r in local.security_envoy_rules : length(r.expression) <= 600])
      error_message = "A security_ske rule expression exceeds STACKIT's 600-character limit for log rules."
    }
  }
}
