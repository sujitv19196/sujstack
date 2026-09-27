resource "neon_project" "app" {
  name                      = var.name
  pg_version                = 17
  region_id                 = var.neon_region
  history_retention_seconds = 21600

  branch {
    name          = "main"
    database_name = "app"
    role_name     = "app"
  }
}

# Every preview deployment shares this branch. It inherits main's role and password.
resource "neon_branch" "preview" {
  project_id = neon_project.app.id
  parent_id  = neon_project.app.default_branch_id
  name       = "preview"
}

resource "neon_endpoint" "preview" {
  project_id = neon_project.app.id
  branch_id  = neon_branch.preview.id
  type       = "read_write"
}

locals {
  credentials = "${neon_project.app.database_user}:${neon_project.app.database_password}"
  database    = "${neon_project.app.database_name}?sslmode=require"

  database_urls = {
    production = {
      pooled   = neon_project.app.connection_uri_pooler
      unpooled = neon_project.app.connection_uri
    }
    preview = {
      pooled   = "postgresql://${local.credentials}@${neon_endpoint.preview.host_pooling}/${local.database}"
      unpooled = "postgresql://${local.credentials}@${neon_endpoint.preview.host}/${local.database}"
    }
  }
}
