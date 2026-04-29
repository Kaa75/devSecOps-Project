output "key_id" {
  description = "ID of the KMS key"
  value       = aws_kms_key.main.key_id
}

output "key_arn" {
  description = "ARN of the KMS key"
  value       = aws_kms_key.main.arn
}

output "key_alias" {
  description = "Alias name of the KMS key"
  value       = aws_kms_alias.main.name
}
