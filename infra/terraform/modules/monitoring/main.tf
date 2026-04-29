locals {
  tags = {
    project     = var.project
    environment = var.environment
    owner       = var.owner
    managed_by  = "terraform"
  }

  topic_name = "${var.project}-${var.environment}-alerts"
}

# ---------------------------------------------------------------------------
# SNS topic for all CloudWatch alarm notifications
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = local.topic_name
  tags = local.tags
}

resource "aws_sns_topic_subscription" "email" {
  count = var.alert_email != null ? 1 : 0

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ---------------------------------------------------------------------------
# Per-service ALB alarms (error rate and P99 latency)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "service_5xx" {
  for_each = var.alb_arn_suffix != "" ? toset(var.services) : toset([])

  alarm_name          = "${var.project}-${var.environment}-${each.key}-5xx-errors"
  alarm_description   = "5xx error count for ${each.key} service exceeded ${var.error_rate_threshold} in a 5-minute window"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.error_rate_threshold
  treat_missing_data  = "notBreaching"

  dimensions = merge(
    { LoadBalancer = var.alb_arn_suffix },
    lookup(var.target_group_arn_suffixes, each.key, null) != null
    ? { TargetGroup = var.target_group_arn_suffixes[each.key] }
    : {}
  )

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.tags
}

resource "aws_cloudwatch_metric_alarm" "service_p99_latency" {
  for_each = var.alb_arn_suffix != "" ? toset(var.services) : toset([])

  alarm_name          = "${var.project}-${var.environment}-${each.key}-p99-latency"
  alarm_description   = "P99 target response time for ${each.key} service exceeded ${var.latency_p99_threshold}s in a 5-minute window"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p99"
  threshold           = var.latency_p99_threshold
  treat_missing_data  = "notBreaching"

  dimensions = merge(
    { LoadBalancer = var.alb_arn_suffix },
    lookup(var.target_group_arn_suffixes, each.key, null) != null
    ? { TargetGroup = var.target_group_arn_suffixes[each.key] }
    : {}
  )

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.tags
}

# ---------------------------------------------------------------------------
# RDS free storage alarm (< 20% of 20 GB = 4 GB)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${var.project}-${var.environment}-rds-low-storage"
  alarm_description   = "RDS free storage space dropped below ${var.rds_free_storage_threshold_bytes / 1073741824} GB (20% of 20 GB)"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_free_storage_threshold_bytes
  treat_missing_data  = "breaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.tags
}

# ---------------------------------------------------------------------------
# ElastiCache memory utilization alarm (> 80%)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "elasticache_memory" {
  alarm_name          = "${var.project}-${var.environment}-redis-high-memory"
  alarm_description   = "ElastiCache memory utilization exceeded ${var.elasticache_memory_threshold}%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = var.elasticache_memory_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.elasticache_cluster_id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.tags
}

# ---------------------------------------------------------------------------
# SQS DLQ message visibility alarm (>= 1 message)
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  alarm_name          = "${var.project}-${var.environment}-dlq-messages"
  alarm_description   = "Messages appeared in the invoice DLQ — manual investigation required"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = var.sqs_dlq_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.tags
}
