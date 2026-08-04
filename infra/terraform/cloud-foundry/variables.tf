variable "project_id" {
  type        = string
  description = "STACKIT project ID that owns the Cloud Foundry org (baergpt-berlin-prod)."
}

variable "region" {
  type        = string
  default     = "eu01"
  description = "STACKIT region hosting the Cloud Foundry platform."
}

variable "org_name" {
  type        = string
  default     = "baergpt"
  description = "Name of the Cloud Foundry organization. Must be unique across the platform."
}

variable "quota_id" {
  type        = string
  description = "CF org-quota GUID (\"Kontingent\")."
}

variable "operators" {
  type        = list(string)
  default     = []
  description = "CF usernames granted organization_user + space_developer on both spaces (the operating/CI account). Each must already exist in UAA (logged in once)."
}

variable "apps_domain" {
  type        = string
  default     = "apps.01.cf.eu01.stackit.cloud"
  description = "Shared CF apps domain. App routes are <app-name>.<apps_domain>; used to build the log drain URL."
}

variable "log_bridge_app_name" {
  type        = string
  default     = "baergpt-log-bridge"
  description = "Base name of the Vector app receiving the drain; the space is appended (-staging/-prod). Must match APP_NAME in .github/workflows/cf-log-bridge-deploy.yml."
}

# Must match DRAIN_USERNAME / DRAIN_PASSWORD in that space's bridge 1Password item; a
# mismatch stops delivery with no error anywhere. Supplied as TF_VAR_drain_credentials
# from the op env-file.
variable "drain_credentials" {
  type = map(object({
    username = string
    password = string
  }))
  sensitive   = true
  description = "Per-space drain basic-auth credentials, keyed by space name."

  validation {
    condition     = alltrue([for c in var.drain_credentials : length(c.password) >= 24])
    error_message = "Drain passwords must be at least 24 characters."
  }

  validation {
    condition     = toset(keys(var.drain_credentials)) == toset(keys(var.spaces))
    error_message = "drain_credentials needs exactly one entry per space: ${join(", ", keys(var.spaces))}."
  }
}

# Per-space settings. Keys must be exactly "staging" and "prod".
variable "spaces" {
  type = map(object({
    allow_ssh           = bool
    total_memory        = number # MB, whole-space cap
    total_app_instances = number
    total_routes        = number
  }))
  default = {
    staging = { allow_ssh = true, total_memory = 8192, total_app_instances = 10, total_routes = 10 }
    prod    = { allow_ssh = false, total_memory = 18432, total_app_instances = 20, total_routes = 20 }
  }

  validation {
    condition     = toset(keys(var.spaces)) == toset(["staging", "prod"])
    error_message = "spaces must contain exactly the keys \"staging\" and \"prod\"."
  }
}
