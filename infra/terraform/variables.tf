variable "aws_region" {
  description = "AWS region for the primary deployment"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "shopcloud"
}

variable "owner" {
  description = "Owner tag value applied to all resources"
  type        = string
  default     = "platform-team"
}

variable "domain_name" {
  description = "Apex domain name for the platform (e.g. shopcloud.example.com)"
  type        = string
}

variable "hosted_zone_id" {
  description = "ID of the Route 53 hosted zone for the domain"
  type        = string
}

variable "ses_from_email" {
  description = "Verified SES sender email address for invoice delivery"
  type        = string
}

variable "server_certificate_arn" {
  description = "ARN of the ACM certificate used for the Client VPN server"
  type        = string
}

variable "client_certificate_arn" {
  description = "ARN of the ACM certificate used for Client VPN client authentication"
  type        = string
}

variable "saml_provider_arn" {
  description = "ARN of the IAM SAML identity provider for VPN MFA (optional)"
  type        = string
  default     = null
}

variable "ecr_image_uri_invoice" {
  description = "ECR image URI for the Invoice Lambda function"
  type        = string
}

variable "rotation_lambda_arn" {
  description = "ARN of the Lambda function used for Secrets Manager rotation (optional)"
  type        = string
  default     = null
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for CloudWatch dimensions (e.g. app/my-alb/1234567890abcdef)"
  type        = string
  default     = ""
}

variable "target_group_arn_suffixes" {
  description = "Map of service name to ALB target group ARN suffix for per-service CloudWatch alarms"
  type        = map(string)
  default     = {}
}

variable "alert_email" {
  description = "Optional email address to subscribe to the SNS alerts topic"
  type        = string
  default     = null
}
