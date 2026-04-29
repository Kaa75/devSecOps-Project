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
