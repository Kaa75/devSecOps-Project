# ─── CD Pipeline IAM Permissions ─────────────────────────────────────────────
# The shopcloud-cd-dev role is created outside Terraform (GitHub OIDC role).
# This policy attaches additional permissions needed by the CD pipeline.

resource "aws_iam_role_policy" "cd_dev_cognito" {
  name = "cognito-list-pool-clients"
  role = "shopcloud-cd-dev"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["cognito-idp:ListUserPoolClients"]
      Resource = [
        module.cognito.customer_pool_arn,
        module.cognito.admin_pool_arn,
      ]
    }]
  })
}

resource "aws_iam_role_policy" "cd_prod_cloudfront" {
  name = "cloudfront-invalidate"
  role = "shopcloud-cd-prod"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cloudfront:CreateInvalidation"]
      Resource = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*"]
    }]
  })
}

data "aws_caller_identity" "current" {}
