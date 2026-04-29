output "secret_arn" {
  description = "ARN of the DB credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "secret_name" {
  description = "Name of the DB credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.name
}

output "irsa_policy_json" {
  description = "IAM policy JSON granting GetSecretValue access; attach to IRSA roles"
  value       = data.aws_iam_policy_document.irsa_secret_access.json
}
