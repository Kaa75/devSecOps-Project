variable "project" {
  description = "Project name used for tagging"
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

variable "vpc_id" {
  description = "ID of the VPC where the VPN endpoint will be created"
  type        = string
}

variable "server_certificate_arn" {
  description = "ARN of the ACM certificate used for the VPN server"
  type        = string
}

variable "client_certificate_arn" {
  description = "ARN of the ACM certificate used for client authentication"
  type        = string
}

variable "saml_provider_arn" {
  description = "ARN of the IAM SAML identity provider for MFA. If null, certificate-only auth is used."
  type        = string
  default     = null
}

variable "client_cidr_block" {
  description = "CIDR block to assign to VPN clients (e.g. 10.100.0.0/22)"
  type        = string
  default     = "10.100.0.0/22"
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs to associate with the VPN endpoint"
  type        = list(string)
}

variable "internal_alb_cidr" {
  description = "CIDR block of the Internal ALB — VPN routes only this traffic through the tunnel"
  type        = string
}

variable "vpc_dns_ip" {
  description = "VPC DNS resolver IP address (typically VPC CIDR base + 2)"
  type        = string
}
