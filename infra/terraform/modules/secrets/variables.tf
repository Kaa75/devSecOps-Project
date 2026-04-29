variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "shopcloud"
}

variable "environment" {
  description = "Deployment environment (e.g. production, development)"
  type        = string
}

variable "owner" {
  description = "Owner tag value for all resources"
  type        = string
  default     = "platform-team"
}

variable "kms_key_arn" {
  description = "ARN of the KMS key used to encrypt the secret"
  type        = string
}

variable "rotation_lambda_arn" {
  description = "ARN of the Lambda function used for automatic secret rotation (optional)"
  type        = string
  default     = null
}
