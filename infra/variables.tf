variable "name" {
  description = "Name of the Vercel project and the Neon project."
  type        = string
  default     = "sujstack"
}

variable "github_repo" {
  description = "The repository Vercel deploys from, as owner/name."
  type        = string
  default     = "sujitv19196/sujstack"
}

variable "neon_org_id" {
  description = "The Neon organization that owns the project (org-…)."
  type        = string
  default     = "org-floral-boat-67774683"
}

variable "neon_region" {
  description = "Neon region. Keep it next to vercel_region."
  type        = string
  default     = "aws-us-east-1"
}

variable "vercel_region" {
  description = "Vercel Functions region. Keep it next to neon_region."
  type        = string
  default     = "iad1"
}

variable "sentry_dsn" {
  description = "Sentry DSN for the server and the browser bundle. Null leaves Sentry inert."
  type        = string
  default     = null
  sensitive   = true
}

variable "otel_endpoint" {
  description = "OTLP/HTTP base URL for metrics. Null drops metrics in production."
  type        = string
  default     = null
  sensitive   = true
}

variable "otel_headers" {
  description = "OTLP headers, comma-separated key=value with URL-encoded values."
  type        = string
  default     = null
  sensitive   = true
}
