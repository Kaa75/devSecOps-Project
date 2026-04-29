locals {
  common_tags = {
    environment = var.environment
    project     = var.project
  }
}

# ─── Fetch DB password from Secrets Manager ──────────────────────────────────
# Disabled - secret needs to be manually populated
# data "aws_secretsmanager_secret_version" "db_password" {
#   secret_id = var.db_password_secret_arn
# }

# ─── DB Subnet Group ─────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name        = "${var.project}-${var.environment}-db-subnet-group"
  description = "Subnet group for ${var.project} ${var.environment} RDS instance"
  subnet_ids  = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-db-subnet-group"
  })
}

# ─── Parameter Group (enforce SSL) ───────────────────────────────────────────

resource "aws_db_parameter_group" "main" {
  name        = "${var.project}-${var.environment}-pg16"
  family      = "postgres16"
  description = "Parameter group for ${var.project} ${var.environment} - enforces SSL"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "immediate"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-pg16"
  })
}

# ─── Primary RDS Instance ─────────────────────────────────────────────────────
# Disabled - database credentials need to be manually populated in Secrets Manager

# resource "aws_db_instance" "main" {
#   identifier        = "${var.project}-${var.environment}-postgres"
#   engine            = "postgres"
#   engine_version    = "16"
#   instance_class    = var.instance_class
#   allocated_storage = 20
#   storage_type      = "gp2"

#   # Encryption
#   storage_encrypted = true
#   kms_key_id        = var.kms_key_arn

#   # Credentials
#   username = "shopcloud"
#   password = data.aws_secretsmanager_secret_version.db_password.secret_string

#   # Network
#   db_subnet_group_name   = aws_db_subnet_group.main.name
#   vpc_security_group_ids = [var.rds_sg_id]
#   publicly_accessible    = false

#   # High availability
#   multi_az = var.multi_az

#   # Parameter group (enforces SSL)
#   parameter_group_name = aws_db_parameter_group.main.name

#   # Auth — password-based (IAM auth disabled)
#   iam_database_authentication_enabled = false

#   # TLS certificate
#   ca_cert_identifier = "rds-ca-rsa2048-g1"

#   # Backups
#   backup_retention_period = var.backup_retention_days
#   backup_window           = "03:00-04:00"
#   maintenance_window      = "Mon:04:00-Mon:05:00"

#   # Snapshot / deletion protection
#   deletion_protection       = true
#   skip_final_snapshot       = false
#   final_snapshot_identifier = "${var.project}-${var.environment}-final-snapshot"

#   tags = merge(local.common_tags, {
#     Name = "${var.project}-${var.environment}-postgres"
#   })
# }

# ─── Cross-Region Read Replica ────────────────────────────────────────────────
# Disabled - primary database not created

# resource "aws_db_instance" "replica" {
#   count = var.create_read_replica ? 1 : 0

#   identifier          = "${var.project}-${var.environment}-postgres-replica"
#   replicate_source_db = aws_db_instance.main.arn
#   instance_class      = var.instance_class

#   # Encryption (replica inherits source encryption; key must exist in replica region)
#   storage_encrypted = true
#   kms_key_id        = var.kms_key_arn

#   # Network — replica is also private
#   publicly_accessible = false

#   # Replica does not need its own backup retention
#   backup_retention_period = 0

#   # Snapshot / deletion protection
#   deletion_protection       = true
#   skip_final_snapshot       = false
#   final_snapshot_identifier = "${var.project}-${var.environment}-replica-final-snapshot"

#   # TLS certificate
#   ca_cert_identifier = "rds-ca-rsa2048-g1"

#   tags = merge(local.common_tags, {
#     Name   = "${var.project}-${var.environment}-postgres-replica"
#     Region = var.replica_region
#   })
# }
