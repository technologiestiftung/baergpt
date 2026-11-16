locals {
  # Groups that cover every environment are created from one workspace, so they exist once.
  shared_alerts_enabled = var.env == "production"
}
