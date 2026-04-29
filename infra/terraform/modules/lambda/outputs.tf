# Commented out - Lambda function resource is disabled
# output "function_arn" {
#   description = "ARN of the Invoice Lambda function"
#   value       = aws_lambda_function.invoice.arn
# }

# output "function_name" {
#   description = "Name of the Invoice Lambda function"
#   value       = aws_lambda_function.invoice.function_name
# }

output "role_arn" {
  description = "ARN of the Lambda IAM role"
  value       = aws_iam_role.invoice_lambda.arn
}
