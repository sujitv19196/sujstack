terraform {
  required_version = ">= 1.10"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.17"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.18"
    }
    render = {
      source  = "render-oss/render"
      version = "~> 1.9"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# Each reads its token from the environment: VERCEL_API_TOKEN, NEON_API_KEY and RENDER_API_KEY.
provider "vercel" {}
provider "neon" {}
provider "render" {
  owner_id = var.render_owner_id
}
