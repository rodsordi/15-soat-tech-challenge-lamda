output "lambda_function_name" {
  value       = aws_lambda_function.auth_handler.function_name
  description = "Name of the Auth Lambda function"
}

output "lambda_function_arn" {
  value       = aws_lambda_function.auth_handler.arn
  description = "ARN of the Auth Lambda function"
}

output "lambda_function_url" {
  value       = aws_lambda_function_url.auth_url.function_url
  description = "Public HTTPS Function URL for client authentication"
}
