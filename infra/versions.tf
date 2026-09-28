terraform {
  required_version = ">= 1.10"

  cloud {
    organization = "sujitv19196"
    workspaces {
      name = "sujstack"
    }
  }

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.17"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.18"
    }
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.6"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# Each reads its token from the environment: VERCEL_API_TOKEN, NEON_API_KEY and RAILWAY_TOKEN.
provider "vercel" {}
provider "neon" {}
provider "railway" {}
