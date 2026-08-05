variable "project_id" {
  type        = string
  description = "STACKIT project ID that owns the Observability instance."
}

variable "instance_id" {
  type        = string
  description = "Observability (Argus) instance ID that receives the OTel telemetry."
}

variable "env" {
  type        = string
  description = "Environment: \"staging\" or \"production\". Names the alert groups and must equal the workspace name."

  # A token that isn't in the telemetry selects nothing: rules apply cleanly and never fire.
  validation {
    condition     = contains(["staging", "production"], var.env)
    error_message = "env must be \"staging\" or \"production\"."
  }

  # Here rather than a resource precondition: validation also runs under `-target` and
  # `terraform destroy`, which skip preconditions.
  validation {
    condition     = var.env == terraform.workspace
    error_message = "Workspace is \"${terraform.workspace}\" but env is \"${var.env}\". Run: terraform workspace select ${var.env}"
  }
}

variable "target_source" {
  type        = string
  description = <<-EOT
    Value of the collector's environment label to alert on — `source` on metrics,
    `service_name` on logs (both set in infra/supabase/otel-config.yml). Always
    "supabase-<env>"; confirm it returns series in Grafana -> Explore.
  EOT

  validation {
    condition     = var.target_source == "supabase-${var.env}"
    error_message = "target_source must be \"supabase-${var.env}\"."
  }
}

# --- Thresholds (tune per environment via *.tfvars) ------------------------------

variable "disk_used_ratio_max" {
  type        = number
  default     = 0.90
  description = "Fire when a filesystem is more than this fraction full (0-1)."

  validation {
    condition     = var.disk_used_ratio_max > 0 && var.disk_used_ratio_max < 1
    error_message = "disk_used_ratio_max is a fraction (0.90), not a percentage (90)."
  }
}

variable "mem_used_ratio_max" {
  type        = number
  default     = 0.90
  description = "Fire when used memory exceeds this fraction of total (0-1)."

  validation {
    condition     = var.mem_used_ratio_max > 0 && var.mem_used_ratio_max < 1
    error_message = "mem_used_ratio_max is a fraction (0.90), not a percentage (90)."
  }
}

variable "cpu_load_15m_max" {
  type        = number
  default     = 4
  description = "Fire when the 15m load average exceeds this. Set to ~= number of vCPUs."

  validation {
    condition     = var.cpu_load_15m_max > 0
    error_message = "cpu_load_15m_max must be positive."
  }
}

variable "kong_5xx_ratio_max" {
  type        = number
  default     = 0.20
  description = "Fire when 5xx exceed this fraction of all Kong requests over 5m (0-1)."

  validation {
    condition     = var.kong_5xx_ratio_max > 0 && var.kong_5xx_ratio_max < 1
    error_message = "kong_5xx_ratio_max is a fraction (0.20), not a percentage (20)."
  }
}

variable "kong_5xx_min_errors_5m" {
  type        = number
  default     = 5
  description = "Floor: the ratio must also be backed by this many 5xx in the 5m window."

  validation {
    condition     = floor(var.kong_5xx_min_errors_5m) == var.kong_5xx_min_errors_5m && var.kong_5xx_min_errors_5m >= 1
    error_message = "kong_5xx_min_errors_5m is a whole-number count >= 1."
  }
}
