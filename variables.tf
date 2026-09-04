variable "aws_region" {
  type        = string
  description = "AWS Region for Lambda deployment"
  default     = "us-east-1"
}

variable "aws_profile" {
  type        = string
  description = "AWS CLI profile name"
  default     = "default"
}

variable "cluster_name" {
  type        = string
  description = "EKS Cluster Name to attach Lambda to VPC"
  default     = "techchallenge-cluster"
}

variable "keycloak_url" {
  type        = string
  description = "Keycloak endpoint URL"
  default     = "http://a3c63e7e0fb384a4c8c29ea5e43c9e17-1683280248.us-east-1.elb.amazonaws.com:8080"
}

variable "keycloak_realm" {
  type        = string
  description = "Keycloak Realm name"
  default     = "garage"
}

variable "keycloak_client_id" {
  type        = string
  description = "Keycloak Client ID"
  default     = "garage-client"
}

variable "keycloak_client_secret" {
  type        = string
  sensitive   = true
  description = "Keycloak Client Secret (if client is confidential)"
  default     = ""
}

variable "keycloak_admin" {
  type        = string
  description = "Keycloak Admin Username for user management API"
  default     = "admin"
}

variable "keycloak_admin_password" {
  type        = string
  sensitive   = true
  description = "Keycloak Admin Password for user management API"
  default     = "Admin@2026!"
}

variable "use_existing_lab_role" {
  type        = bool
  description = "Use existing AWS Academy LabRole instead of creating new IAM role"
  default     = true
}

variable "newrelic_account_id" {
  type        = string
  description = "New Relic Account ID for Lambda Serverless APM"
  default     = ""
}

variable "newrelic_license_key" {
  type        = string
  sensitive   = true
  description = "New Relic Ingest License Key for Lambda Serverless APM"
  default     = ""
}

variable "enable_newrelic" {
  type        = bool
  description = "Enable New Relic Serverless Lambda Layer instrumentation"
  default     = true
}


