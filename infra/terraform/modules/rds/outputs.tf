output "db_instance_endpoint" {
  description = "Connection endpoint for the primary RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_id" {
  description = "Identifier of the primary RDS instance"
  value       = aws_db_instance.main.id
}

output "db_instance_arn" {
  description = "ARN of the primary RDS instance"
  value       = aws_db_instance.main.arn
}

output "db_subnet_group_name" {
  description = "Name of the DB subnet group"
  value       = aws_db_subnet_group.main.name
}
