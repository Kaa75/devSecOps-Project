variable "project" {
  description = "Project name used for naming and tagging"
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

variable "kms_key_arn" {
  description = "ARN of the KMS key used for S3 bucket encryption"
  type        = string
}
