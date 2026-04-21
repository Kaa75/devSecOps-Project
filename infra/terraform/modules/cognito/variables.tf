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

variable "access_token_validity_hours" {
  description = "JWT access token validity in hours"
  type        = number
  default     = 1
}

variable "refresh_token_validity_days" {
  description = "JWT refresh token validity in days"
  type        = number
  default     = 30
}
