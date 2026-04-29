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

variable "ecr_image_uri" {
  description = "ECR image URI for the Invoice Lambda function"
  type        = string
}

variable "sqs_queue_arn" {
  description = "ARN of the SQS invoice queue to use as event source"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 invoice bucket (used for IAM policy scoping)"
  type        = string
}

variable "kms_key_arn" {
  description = "ARN of the KMS key used for decryption"
  type        = string
}

variable "ses_from_email" {
  description = "Verified SES sender email address"
  type        = string
}

variable "oidc_provider_arn" {
  description = "ARN of the OIDC provider for IRSA trust policy"
  type        = string
}

variable "service_account_namespace" {
  description = "Kubernetes namespace of the service account (used in IRSA trust policy)"
  type        = string
  default     = "default"
}
