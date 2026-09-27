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
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# Both read their token from the environment: VERCEL_API_TOKEN and NEON_API_KEY.
provider "vercel" {}
provider "neon" {}
