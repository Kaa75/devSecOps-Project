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
  description = "Owner tag value applied to all resources"
  type        = string
  default     = "platform-team"
}

variable "is_production" {
  description = "When true, creates a 2-node Multi-AZ cluster; when false, creates a single-node cluster"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "ID of the VPC where the ElastiCache cluster will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ElastiCache subnet group (use private subnets)"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "List of security group IDs allowed to connect to Redis on port 6379"
  type        = list(string)
}

variable "create_security_group" {
  description = "Whether to create a dedicated Redis security group in this module"
  type        = bool
  default     = true
}

variable "existing_security_group_id" {
  description = "Existing Redis security group ID to use when create_security_group is false"
  type        = string
  default     = null
}
