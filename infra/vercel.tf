resource "vercel_project" "app" {
  name           = var.name
  framework      = "nextjs"
  root_directory = "apps/next"
  build_command  = "bun run --filter @app/db db:migrate && bun run build"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
    deploy_hooks = [
      { name = "terraform", ref = "main" },
    ]
  }

  resource_config = {
    function_default_regions = [var.vercel_region]
  }
}

resource "random_password" "demo_webhook" {
  length  = 48
  special = false
}

locals {
  optional_variables = {
    SENTRY_DSN                  = var.sentry_dsn
    NEXT_PUBLIC_SENTRY_DSN      = var.sentry_dsn
    OTEL_EXPORTER_OTLP_ENDPOINT = var.otel_endpoint
    OTEL_EXPORTER_OTLP_HEADERS  = var.otel_headers
  }

  environment_variables = concat(
    flatten([
      for target, urls in local.database_urls : [
        { key = "DATABASE_URL", value = urls.pooled, target = [target] },
        { key = "DATABASE_URL_UNPOOLED", value = urls.unpooled, target = [target] },
      ]
    ]),
    [
      {
        key    = "DEMO_WEBHOOK_SECRET"
        value  = random_password.demo_webhook.result
        target = ["production", "preview"]
      },
    ],
    [
      for key, value in local.optional_variables : {
        key    = key
        value  = value
        target = ["production", "preview"]
      } if nonsensitive(value != null)
    ],
  )
}

resource "vercel_project_environment_variables" "app" {
  project_id = vercel_project.app.id
  variables = [
    for variable in local.environment_variables : merge(variable, { sensitive = true })
  ]
}

# Env vars only reach a deployment built after they changed, so redeploy main when they do.
# This also makes the first production deployment, which runs the first migration.
resource "terraform_data" "redeploy" {
  triggers_replace = nonsensitive(sha256(jsonencode(local.environment_variables)))

  provisioner "local-exec" {
    command = "curl --fail --silent --show-error -X POST \"$DEPLOY_HOOK\""
    environment = {
      DEPLOY_HOOK = one(vercel_project.app.git_repository.deploy_hooks).url
    }
  }

  depends_on = [vercel_project_environment_variables.app]
}
