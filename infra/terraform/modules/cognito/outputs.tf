output "customer_pool_id" {
  description = "ID of the Customer Cognito User Pool"
  value       = aws_cognito_user_pool.customer.id
}

output "customer_pool_arn" {
  description = "ARN of the Customer Cognito User Pool"
  value       = aws_cognito_user_pool.customer.arn
}

output "customer_client_id" {
  description = "ID of the Customer Pool app client"
  value       = aws_cognito_user_pool_client.customer.id
}

output "admin_pool_id" {
  description = "ID of the Admin Cognito User Pool"
  value       = aws_cognito_user_pool.admin.id
}

output "admin_pool_arn" {
  description = "ARN of the Admin Cognito User Pool"
  value       = aws_cognito_user_pool.admin.arn
}

output "admin_client_id" {
  description = "ID of the Admin Pool app client"
  value       = aws_cognito_user_pool_client.admin.id
}
