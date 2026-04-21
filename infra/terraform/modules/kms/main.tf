locals {
  common_tags = {
    environment = var.environment
    project     = var.project
    owner       = var.owner
  }
}

# ─── KMS Key ──────────────────────────────────────────────────────────────────
# Single key used for RDS encryption, S3 bucket encryption, and EKS secrets encryption

resource "aws_kms_key" "main" {
  description             = "${var.project}-${var.environment} main encryption key (RDS, S3, EKS)"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-main"
  })
}

# ─── Key Alias ────────────────────────────────────────────────────────────────

resource "aws_kms_alias" "main" {
  name          = "alias/${var.project}-${var.environment}-main"
  target_key_id = aws_kms_key.main.key_id
}
