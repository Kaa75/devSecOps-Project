locals {
  common_tags = {
    environment = var.environment
    project     = var.project
    owner       = var.owner
  }

  secret_name = "${var.project}/${var.environment}/db-credentials"
}

# ─── DB Credentials Secret ────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = local.secret_name
  description = "Database credentials for ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_arn

  tags = merge(local.common_tags, {
    Name = local.secret_name
  })
}

# ─── Automatic Rotation (optional) ───────────────────────────────────────────

resource "aws_secretsmanager_secret_rotation" "db_credentials" {
  count = var.rotation_lambda_arn != null ? 1 : 0

  secret_id           = aws_secretsmanager_secret.db_credentials.id
  rotation_lambda_arn = var.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = 30
  }
}

# ─── IRSA Policy Document ─────────────────────────────────────────────────────
# Grants GetSecretValue access; output as JSON for use by IRSA roles

data "aws_iam_policy_document" "irsa_secret_access" {
  statement {
    sid    = "AllowGetSecretValue"
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
    ]

    resources = [
      aws_secretsmanager_secret.db_credentials.arn,
    ]
  }
}
