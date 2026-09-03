terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket = "techchallenge-fiap-tfstate-890958457263"
    key    = "lambda/terraform.tfstate"
    region = "us-east-1"
  }

  required_providers {

    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" && var.aws_profile != "default" ? var.aws_profile : null

  default_tags {
    tags = {
      Project     = "SOAT-TechChallenge"
      Environment = "production"
      Component   = "Auth-Lambda"
      ManagedBy   = "Terraform"
    }
  }
}
