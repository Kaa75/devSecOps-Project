locals {
  dashboard_name = "${var.project}-${var.environment}-dashboard"
  services       = ["catalog", "cart", "checkout", "auth", "admin"]
  namespace      = "shopcloud"
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = local.dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      # ── CPU utilization for all 5 services ──────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Pod CPU Utilization"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            for svc in local.services : [
              "ContainerInsights",
              "pod_cpu_utilization",
              "ClusterName", var.cluster_name,
              "Namespace", local.namespace,
              "PodName", svc,
              { label = svc }
            ]
          ]
          period = 60
          stat   = "Average"
          yAxis = {
            left = { min = 0, max = 100, label = "%" }
          }
        }
      },

      # ── Memory utilization for all 5 services ───────────────────────────
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Pod Memory Utilization"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            for svc in local.services : [
              "ContainerInsights",
              "pod_memory_utilization",
              "ClusterName", var.cluster_name,
              "Namespace", local.namespace,
              "PodName", svc,
              { label = svc }
            ]
          ]
          period = 60
          stat   = "Average"
          yAxis = {
            left = { min = 0, max = 100, label = "%" }
          }
        }
      },

      # ── ALB request count ────────────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB Request Count"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            [
              "AWS/ApplicationELB",
              "RequestCount",
              "LoadBalancer", var.alb_arn_suffix,
              { label = "Requests", stat = "Sum" }
            ]
          ]
          period = 60
          stat   = "Sum"
        }
      },

      # ── ALB 5xx error rate ───────────────────────────────────────────────
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "ALB 5xx Errors"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            [
              "AWS/ApplicationELB",
              "HTTPCode_Target_5XX_Count",
              "LoadBalancer", var.alb_arn_suffix,
              { label = "5xx Errors", stat = "Sum", color = "#d62728" }
            ]
          ]
          period = 60
          stat   = "Sum"
        }
      },

      # ── RDS free storage space ───────────────────────────────────────────
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "RDS Free Storage Space"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            [
              "AWS/RDS",
              "FreeStorageSpace",
              "DBInstanceIdentifier", var.rds_instance_id,
              { label = "Free Storage (bytes)", stat = "Average" }
            ]
          ]
          period = 60
          stat   = "Average"
        }
      },

      # ── Redis memory utilization ─────────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "Redis Memory Utilization"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            [
              "AWS/ElastiCache",
              "DatabaseMemoryUsagePercentage",
              "CacheClusterId", var.elasticache_cluster_id,
              { label = "Memory %", stat = "Average" }
            ]
          ]
          period = 60
          stat   = "Average"
          yAxis = {
            left = { min = 0, max = 100, label = "%" }
          }
        }
      },

      # ── SQS queue depth (invoice queue + DLQ) ───────────────────────────
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 16
        height = 6
        properties = {
          title  = "SQS Queue Depth"
          view   = "timeSeries"
          region = data.aws_region.current.name
          metrics = [
            [
              "AWS/SQS",
              "ApproximateNumberOfMessagesVisible",
              "QueueName", var.sqs_queue_name,
              { label = "Invoice Queue", stat = "Maximum" }
            ],
            [
              "AWS/SQS",
              "ApproximateNumberOfMessagesVisible",
              "QueueName", var.sqs_dlq_name,
              { label = "DLQ", stat = "Maximum", color = "#d62728" }
            ]
          ]
          period = 60
          stat   = "Maximum"
        }
      }
    ]
  })
}

data "aws_region" "current" {}
