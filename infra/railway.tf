resource "railway_project" "app" {
  name = var.name
}

# Builds and runs apps/worker from the repo root, following apps/worker/railway.json.
resource "railway_service" "worker" {
  name               = "worker"
  project_id         = railway_project.app.id
  source_repo        = var.github_repo
  source_repo_branch = "main"
  config_path        = "apps/worker/railway.json"

  regions = [
    { region = var.railway_region, num_replicas = 1 },
  ]
}

locals {
  worker_variables = merge(
    {
      NODE_ENV     = "production"
      DATABASE_URL = local.database_urls.production.unpooled
    },
    {
      for key, value in {
        OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_endpoint
        OTEL_EXPORTER_OTLP_HEADERS  = var.otel_headers
      } : key => value if nonsensitive(value != null)
    },
  )
}

resource "railway_variable_collection" "worker" {
  environment_id = railway_project.app.default_environment.id
  service_id     = railway_service.worker.id
  variables = [
    for name, value in local.worker_variables : { name = name, value = value }
  ]
}

resource "random_id" "worker_domain" {
  byte_length = 3
}

# Public so an uptime monitor can reach /health; the worker serves nothing else.
resource "railway_service_domain" "worker" {
  environment_id = railway_project.app.default_environment.id
  service_id     = railway_service.worker.id
  subdomain      = "${var.name}-worker-${random_id.worker_domain.hex}"
}
