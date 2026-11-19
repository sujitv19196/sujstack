# Builds from the repo root, so the workspace and the kit submodule are in the build.
resource "render_background_worker" "worker" {
  count = var.worker_enabled ? 1 : 0

  name                       = "${var.name}-worker"
  plan                       = "starter"
  region                     = var.render_region
  start_command              = "bun run --cwd apps/worker start"
  max_shutdown_delay_seconds = 60

  runtime_source = {
    native_runtime = {
      runtime       = "node"
      repo_url      = "https://github.com/${var.github_repo}"
      branch        = "main"
      auto_deploy   = true
      build_command = "bun install --frozen-lockfile"
      build_filter = {
        paths = [
          "apps/worker/**",
          # The worker runs @app/server (and what it imports) from source.
          "packages/**",
          "kit",
          "kit/**",
          "bun.lock",
          "package.json",
        ]
      }
    }
  }

  env_vars = { for key, value in local.worker_env : key => { value = value } }
}

locals {
  worker_env = merge(
    {
      NODE_ENV     = "production"
      DATABASE_URL = local.database_urls.production.unpooled
      BUN_VERSION  = "1.4.0"
    },
    {
      for key, value in {
        OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_endpoint
        OTEL_EXPORTER_OTLP_HEADERS  = var.otel_headers
      } : key => value if nonsensitive(value != null)
    },
  )
}
