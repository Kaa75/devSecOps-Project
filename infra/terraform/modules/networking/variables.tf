variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
}

variable "enable_nat_gateway" {
  description = "If true, provision one NAT Gateway per public subnet. If false, use a single NAT Gateway."
  type        = bool
  default     = true
}

variable "environment" {
  description = "Deployment environment (e.g. production, development)"
  type        = string
}

variable "project" {
  description = "Project name used for tagging"
  type        = string
  default     = "shopcloud"
}
