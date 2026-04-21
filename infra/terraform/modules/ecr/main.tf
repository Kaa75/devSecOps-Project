locals {
  common_tags = {
    environment = var.environment
    project     = var.project
    owner       = var.owner
  }

  services = [
    "catalog",
    "cart",
    "checkout",
    "auth",
    "admin",
    "invoice-lambda",
  ]

  lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ─── ECR Repositories ─────────────────────────────────────────────────────────

resource "aws_ecr_repository" "services" {
  for_each = toset(local.services)

  name                 = "${var.project}/${var.environment}/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(local.common_tags, {
    Name    = "${var.project}-${var.environment}-${each.key}"
    service = each.key
  })
}

# ─── Lifecycle Policies ───────────────────────────────────────────────────────

resource "aws_ecr_lifecycle_policy" "services" {
  for_each = aws_ecr_repository.services

  repository = each.value.name
  policy     = local.lifecycle_policy
}
