locals {
  common_tags = {
    project     = var.project
    environment = var.environment
    owner       = var.owner
  }
}

resource "aws_sqs_queue" "invoice_dlq" {
  name                       = "${var.project}-${var.environment}-invoice-dlq"
  message_retention_seconds  = 1209600 # 14 days

  tags = local.common_tags
}

resource "aws_sqs_queue" "invoice" {
  name                       = "${var.project}-${var.environment}-invoice"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400 # 1 day

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.invoice_dlq.arn
    maxReceiveCount     = 3
  })

  tags = local.common_tags
}
