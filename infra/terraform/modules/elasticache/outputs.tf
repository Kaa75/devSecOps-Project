output "redis_endpoint" {
  description = "Primary endpoint address for the Redis replication group"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Port number for the Redis cluster"
  value       = aws_elasticache_replication_group.main.port
}

output "security_group_id" {
  description = "ID of the security group attached to the Redis cluster"
  value       = aws_security_group.redis.id
}

output "replication_group_id" {
  description = "ID of the ElastiCache replication group (used as CloudWatch CacheClusterId dimension)"
  value       = aws_elasticache_replication_group.main.replication_group_id
}
