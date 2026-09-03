# --- Archive Lambda Source Code ---
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/build/lambda.zip"
}

# --- IAM Role (AWS Academy LabRole) ---
data "aws_iam_role" "lab_role" {
  name = "LabRole"
}

# --- VPC Discovery from EKS Infrastructure ---
data "aws_vpc" "eks_vpc" {
  filter {
    name   = "tag:Name"
    values = ["${var.cluster_name}-vpc"]
  }
}

data "aws_subnets" "private_subnets" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.eks_vpc.id]
  }

  filter {
    name   = "tag:kubernetes.io/role/internal-elb"
    values = ["1"]
  }
}

# --- Lambda Security Group ---
resource "aws_security_group" "lambda_sg" {
  name        = "${var.cluster_name}-auth-lambda-sg"
  description = "Security group for Auth Lambda attached to EKS VPC"
  vpc_id      = data.aws_vpc.eks_vpc.id

  egress {
    description = "Allow all outbound traffic (to Keycloak and external)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.cluster_name}-auth-lambda-sg"
  }
}

# --- AWS Lambda Function ---
resource "aws_lambda_function" "auth_handler" {
  function_name = "garage-auth-handler"
  description   = "Serverless Auth Handler proxying login requests to Keycloak and returning JWT"
  role          = data.aws_iam_role.lab_role.arn
  runtime       = "nodejs20.x"
  handler       = var.enable_newrelic && var.newrelic_license_key != "" ? "newrelic-lambda-wrapper.handler" : "index.handler"
  layers        = var.enable_newrelic && var.newrelic_license_key != "" ? ["arn:aws:lambda:${var.aws_region}:451483290750:layer:NewRelicNodeJS20X:1"] : []
  timeout       = 15
  memory_size   = 128

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  vpc_config {
    subnet_ids         = data.aws_subnets.private_subnets.ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = merge(
      {
        KEYCLOAK_URL            = var.keycloak_url
        KEYCLOAK_REALM          = var.keycloak_realm
        KEYCLOAK_CLIENT_ID      = var.keycloak_client_id
        KEYCLOAK_CLIENT_SECRET  = var.keycloak_client_secret
        KEYCLOAK_ADMIN          = var.keycloak_admin
        KEYCLOAK_ADMIN_PASSWORD = var.keycloak_admin_password
      },
      var.enable_newrelic && var.newrelic_license_key != "" ? {
        NEW_RELIC_ACCOUNT_ID                   = var.newrelic_account_id
        NEW_RELIC_LICENSE_KEY                  = var.newrelic_license_key
        NEW_RELIC_LAMBDA_HANDLER               = "index.handler"
        NEW_RELIC_EXTENSION_SEND_FUNCTION_LOGS = "true"
      } : {}
    )
  }

  tags = {
    Name = "garage-auth-handler"
  }
}


# --- Lambda Function URL (Public HTTPS Endpoint) ---
resource "aws_lambda_function_url" "auth_url" {
  function_name      = aws_lambda_function.auth_handler.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = false
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-Requested-With"]
    expose_headers    = ["*"]
    max_age           = 300
  }
}


# --- Permission for Public Function URL Invocation ---
resource "aws_lambda_permission" "public_function_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.auth_handler.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
