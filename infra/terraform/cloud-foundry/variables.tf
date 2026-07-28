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

# Per-space settings. Keys must be exactly "staging" and "prod".
variable "spaces" {
  type = map(object({
    allow_ssh           = bool
    total_memory        = number # MB, whole-space cap
    total_app_instances = number
    total_routes        = number
  }))
  default = {
    staging = { allow_ssh = true, total_memory = 4096, total_app_instances = 10, total_routes = 10 }
    prod    = { allow_ssh = false, total_memory = 18432, total_app_instances = 20, total_routes = 20 }
  }

  validation {
    condition     = toset(keys(var.spaces)) == toset(["staging", "prod"])
    error_message = "spaces must contain exactly the keys \"staging\" and \"prod\"."
  }
}
