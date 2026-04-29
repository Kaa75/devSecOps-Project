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

variable "alb_dns_name" {
  description = "DNS name of the Public ALB used as the CloudFront origin"
  type        = string
}

variable "waf_acl_arn" {
  description = "ARN of the WAF WebACL to associate with the CloudFront distribution"
  type        = string
}
