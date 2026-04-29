output "sns_topic_arn" {
  description = "ARN of the SNS topic used for all CloudWatch alarm notifications"
  value       = aws_sns_topic.alerts.arn
}

output "sns_topic_name" {
  description = "Name of the SNS alerts topic"
  value       = aws_sns_topic.alerts.name
}

output "service_5xx_alarm_arns" {
  description = "Map of service name to 5xx error alarm ARN"
  value       = { for k, v in aws_cloudwatch_metric_alarm.service_5xx : k => v.arn }
}

output "service_p99_latency_alarm_arns" {
  description = "Map of service name to P99 latency alarm ARN"
  value       = { for k, v in aws_cloudwatch_metric_alarm.service_p99_latency : k => v.arn }
}

output "rds_free_storage_alarm_arn" {
  description = "ARN of the RDS free storage alarm"
  value       = aws_cloudwatch_metric_alarm.rds_free_storage.arn
}

output "elasticache_memory_alarm_arn" {
  description = "ARN of the ElastiCache memory utilization alarm"
  value       = aws_cloudwatch_metric_alarm.elasticache_memory.arn
}

output "sqs_dlq_alarm_arn" {
  description = "ARN of the SQS DLQ message visibility alarm"
  value       = aws_cloudwatch_metric_alarm.sqs_dlq_messages.arn
}
