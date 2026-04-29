locals {
  common_tags = {
    environment = var.environment
    project     = var.project
    owner       = var.owner
  }

  num_cache_clusters = var.is_production ? 2 : 1
  redis_sg_id        = var.create_security_group ? aws_security_group.redis[0].id : var.existing_security_group_id
}

# ─── ElastiCache Subnet Group ─────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project}-${var.environment}-redis-subnet-group"
  description = "Subnet group for ${var.project} ${var.environment} Redis cluster"
  subnet_ids  = var.subnet_ids

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-redis-subnet-group"
  })
}

# ─── Security Group ───────────────────────────────────────────────────────────

resource "aws_security_group" "redis" {
  count       = var.create_security_group ? 1 : 0
  name        = "${var.project}-${var.environment}-redis-sg"
  description = "Security group for ${var.project} ${var.environment} Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from allowed security groups"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-redis-sg"
  })
}

# ─── ElastiCache Replication Group ───────────────────────────────────────────

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project}-${var.environment}-redis"
  description          = "Redis replication group for ${var.project} ${var.environment}"

  node_type            = "cache.t3.micro"
  num_cache_clusters   = local.num_cache_clusters
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [local.redis_sg_id]

  # Multi-AZ and automatic failover only when we have >= 2 nodes
  multi_az_enabled           = var.is_production
  automatic_failover_enabled = var.is_production

  # Encryption
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true

  # Maintenance
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = var.is_production ? 7 : 1
  snapshot_window          = "04:00-05:00"

  apply_immediately = !var.is_production

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-redis"
  })
}
