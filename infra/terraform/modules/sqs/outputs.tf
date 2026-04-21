output "queue_url" {
  description = "URL of the invoice SQS queue"
  value       = aws_sqs_queue.invoice.url
}

output "queue_arn" {
  description = "ARN of the invoice SQS queue"
  value       = aws_sqs_queue.invoice.arn
}

output "dlq_url" {
  description = "URL of the invoice Dead Letter Queue"
  value       = aws_sqs_queue.invoice_dlq.url
}

output "dlq_arn" {
  description = "ARN of the invoice Dead Letter Queue"
  value       = aws_sqs_queue.invoice_dlq.arn
}

output "dlq_name" {
  description = "Name of the invoice Dead Letter Queue (used as CloudWatch QueueName dimension)"
  value       = aws_sqs_queue.invoice_dlq.name
}

output "queue_name" {
  description = "Name of the invoice SQS queue (used as CloudWatch QueueName dimension)"
  value       = aws_sqs_queue.invoice.name
}
