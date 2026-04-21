variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
}

variable "environment" {
  description = "Deployment environment (production or development)"
  type        = string
}

variable "owner" {
  description = "Owner tag value for all resources"
  type        = string
}

variable "services" {
  description = "List of microservice names to create alarms for"
  type        = list(string)
  default     = ["catalog", "cart", "checkout", "auth", "admin"]
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix used as CloudWatch dimension (e.g. app/my-alb/1234567890abcdef)"
  type        = string
}

variable "target_group_arn_suffixes" {
  description = "Map of service name to ALB target group ARN suffix for CloudWatch dimensions"
  type        = map(string)
  default     = {}
}

variable "rds_instance_id" {
  description = "RDS instance identifier for storage alarm"
  type        = string
}

variable "elasticache_cluster_id" {
  description = "ElastiCache cluster ID for memory utilization alarm"
  type        = string
}

variable "sqs_dlq_name" {
  description = "SQS dead-letter queue name for message visibility alarm"
  type        = string
}

variable "alert_email" {
  description = "Optional email address to subscribe to the SNS alerts topic"
  type        = string
  default     = null
}

variable "error_rate_threshold" {
  description = "Number of 5xx errors per 5-minute window that triggers the error rate alarm"
  type        = number
  default     = 10
}

variable "latency_p99_threshold" {
  description = "P99 target response time in seconds that triggers the latency alarm"
  type        = number
  default     = 2
}

variable "rds_free_storage_threshold_bytes" {
  description = "RDS free storage threshold in bytes below which the alarm fires (default 4 GB = 20% of 20 GB)"
  type        = number
  default     = 4294967296 # 4 GB
}

variable "elasticache_memory_threshold" {
  description = "ElastiCache memory utilization percentage above which the alarm fires"
  type        = number
  default     = 80
}
