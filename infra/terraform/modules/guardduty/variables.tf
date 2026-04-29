variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production, development)"
  type        = string
}

variable "owner" {
  description = "Owner tag value for all resources"
  type        = string
}

variable "sns_topic_arn" {
  description = "ARN of the SNS topic to receive GuardDuty HIGH/CRITICAL finding alerts"
  type        = string
}

variable "enable_guardduty" {
  description = "Whether to create GuardDuty detector and alerting resources"
  type        = bool
  default     = false
}
