locals {
  function_name = "${var.project}-${var.environment}-invoice"

  common_tags = {
    project     = var.project
    environment = var.environment
    owner       = var.owner
  }

  # Extract OIDC provider URL from ARN for the trust policy condition
  oidc_provider_url = replace(var.oidc_provider_arn, "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/", "")
}

data "aws_caller_identity" "current" {}

# IAM role for the Lambda with IRSA-style trust policy
resource "aws_iam_role" "invoice_lambda" {
  name = "${local.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${local.oidc_provider_url}:sub" = "system:serviceaccount:${var.service_account_namespace}:${local.function_name}"
          }
        }
      },
      # Also allow Lambda service to assume this role
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

# Inline policy scoped to required permissions
resource "aws_iam_role_policy" "invoice_lambda" {
  name = "${local.function_name}-policy"
  role = aws_iam_role.invoice_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3InvoiceObjects"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${var.s3_bucket_arn}/invoices/*"
      },
      {
        Sid      = "SESSendEmail"
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = var.ses_from_email
          }
        }
      },
      {
        Sid      = "SecretsManagerGet"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:*:${data.aws_caller_identity.current.account_id}:secret:${var.project}/${var.environment}/*"
      },
      {
        Sid      = "KMSDecrypt"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = var.kms_key_arn
      },
      {
        Sid    = "SQSReceive"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = var.sqs_queue_arn
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.function_name}:*"
      }
    ]
  })
}

resource "aws_ses_email_identity" "invoice_sender" {
  email = var.ses_from_email
}

# Lambda function deployed from ECR image
resource "aws_lambda_function" "invoice" {
  function_name = local.function_name
  role          = aws_iam_role.invoice_lambda.arn
  package_type  = "Image"
  image_uri     = var.ecr_image_uri
  timeout       = 300
  memory_size   = 512

  environment {
    variables = {
      SES_FROM_EMAIL = var.ses_from_email
      S3_BUCKET_NAME = var.s3_bucket_name
      ENVIRONMENT    = var.environment
    }
  }

  depends_on = [aws_iam_role_policy.invoice_lambda]

  tags = local.common_tags
}

# SQS event source mapping (batch size 1)
resource "aws_lambda_event_source_mapping" "invoice_sqs" {
  event_source_arn = var.sqs_queue_arn
  function_name    = aws_lambda_function.invoice.arn
  batch_size       = 1
  enabled          = true
}
