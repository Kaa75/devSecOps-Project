variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
}

variable "environment" {
  description = "Deployment environment (production or development)"
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name used for ContainerInsights metric dimensions"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch dimensions (e.g. app/my-alb/1234567890abcdef)"
  type        = string
}

variable "rds_instance_id" {
  description = "RDS instance identifier for storage metric widget"
  type        = string
}

variable "elasticache_cluster_id" {
  description = "ElastiCache cluster ID for memory metric widget"
  type        = string
}

variable "sqs_queue_name" {
  description = "SQS invoice queue name for queue depth widget"
  type        = string
}

variable "sqs_dlq_name" {
  description = "SQS dead-letter queue name for queue depth widget"
  type        = string
}
