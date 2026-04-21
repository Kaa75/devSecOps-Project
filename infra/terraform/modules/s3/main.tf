locals {
  bucket_name = "${var.project}-${var.environment}-invoices"

  common_tags = {
    project     = var.project
    environment = var.environment
    owner       = var.owner
  }
}

resource "aws_s3_bucket" "invoices" {
  bucket = local.bucket_name

  tags = local.common_tags
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Private ACL
resource "aws_s3_bucket_acl" "invoices" {
  bucket     = aws_s3_bucket.invoices.id
  acl        = "private"
  depends_on = [aws_s3_bucket_ownership_controls.invoices]
}

resource "aws_s3_bucket_ownership_controls" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# KMS encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

# Lifecycle policy: STANDARD_IA after 30 days, expire after 365 days
resource "aws_s3_bucket_lifecycle_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id

  rule {
    id     = "invoice-lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 365
    }
  }
}
