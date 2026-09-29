resource "railway_project" "app" {
  name = var.name
}

# Builds from the repo root, so the workspace and the kit submodule are in the build. The build and
# start commands are the RAILPACK_* variables below.
resource "railway_service" "worker" {
  name               = "worker"
  project_id         = railway_project.app.id
  source_repo        = var.github_repo
  source_repo_branch = "main"

  regions = [
    { region = var.railway_region, num_replicas = 1 },
  ]
}

locals {
  worker_variables = merge(
    {
      NODE_ENV     = "production"
      DATABASE_URL = local.database_urls.production.unpooled
      # Without these, Railpack would run the root package.json's `build` and `start`: the Next app.
      RAILPACK_BUILD_CMD = "echo 'apps/worker runs from source'"
      RAILPACK_START_CMD = "bun run --cwd apps/worker start"
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
