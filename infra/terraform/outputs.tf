# ─── EKS ─────────────────────────────────────────────────────────────────────

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "API server endpoint of the EKS cluster"
  value       = module.eks.cluster_endpoint
}

# ─── RDS ─────────────────────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "Connection endpoint for the primary RDS instance"
  value       = module.rds.db_instance_endpoint
}

# ─── ElastiCache ─────────────────────────────────────────────────────────────

output "redis_endpoint" {
  description = "Primary endpoint address for the Redis cluster"
  value       = module.elasticache.redis_endpoint
}

# ─── Cognito ─────────────────────────────────────────────────────────────────

output "cognito_customer_pool_id" {
  description = "ID of the Cognito Customer User Pool"
  value       = module.cognito.customer_pool_id
}

output "cognito_customer_client_id" {
  description = "ID of the Cognito Customer Pool app client"
  value       = module.cognito.customer_client_id
}

output "cognito_admin_pool_id" {
  description = "ID of the Cognito Admin User Pool"
  value       = module.cognito.admin_pool_id
}

output "cognito_admin_client_id" {
  description = "ID of the Cognito Admin Pool app client"
  value       = module.cognito.admin_client_id
}

# ─── CloudFront ──────────────────────────────────────────────────────────────

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = module.cloudfront.distribution_domain_name
}

# ─── ECR ─────────────────────────────────────────────────────────────────────

output "ecr_repository_urls" {
  description = "Map of service name to ECR repository URL"
  value       = module.ecr.repository_urls
}

# ─── Monitoring ──────────────────────────────────────────────────────────────

output "monitoring_sns_topic_arn" {
  description = "ARN of the SNS topic used for CloudWatch alarm notifications"
  value       = module.monitoring.sns_topic_arn
}

# ─── CloudWatch Dashboard ─────────────────────────────────────────────────────

output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = module.cloudwatch_dashboard.dashboard_name
}
