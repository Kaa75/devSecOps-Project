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

variable "hosted_zone_id" {
  description = "ID of the Route 53 hosted zone"
  type        = string
}

variable "domain_name" {
  description = "Apex domain name (e.g. shopcloud.example.com)"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution for the apex alias record"
  type        = string
}

variable "eu_alb_dns_name" {
  description = "DNS name of the EU region Public ALB for latency-based routing"
  type        = string
}

variable "us_alb_dns_name" {
  description = "DNS name of the US region Public ALB for latency-based routing"
  type        = string
}
