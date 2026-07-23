terraform {
  # Exact CLI version is pinned in .tool-versions.
  required_version = "~> 1.11"

  required_providers {
    stackit = {
      source  = "stackitcloud/stackit"
      version = "~> 0.100.0"
    }
  }

  # Remote state on STACKIT Object Storage (S3-compatible). See README "Remote state".
  backend "s3" {
    bucket                      = "baergpt-tfstate"
    key                         = "observability/terraform.tfstate" # per-workspace: env:/<ws>/ is prefixed
    region                      = "eu01"
    endpoints                   = { s3 = "https://object.storage.eu01.onstackit.cloud" }
    use_path_style              = true
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true # STACKIT's S3 API rejects the AWS SDK checksum header
    # No use_lockfile: STACKIT doesn't honor S3 conditional-write locks (stackitcloud/terraform-provider-stackit#1534).
    # Backend creds are AWS_ACCESS_KEY_ID/SECRET (op run), separate from the provider's SA key.
  }
}
