locals {
  common_tags = {
    environment = var.environment
    project     = var.project
    owner       = var.owner
  }
}

# ─── Password Policy (shared) ─────────────────────────────────────────────────
# Enforced on both pools: 8+ chars, uppercase, digit, special character

locals {
  password_policy = {
    minimum_length                   = 8
    require_uppercase_letters        = true
    require_lowercase_letters        = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }
}

# ─── Customer User Pool ───────────────────────────────────────────────────────

resource "aws_cognito_user_pool" "customer" {
  name = "${var.project}-${var.environment}-customer-pool"

  password_policy {
    minimum_length                   = local.password_policy.minimum_length
    require_numbers                  = local.password_policy.require_numbers
    require_symbols                  = local.password_policy.require_symbols
    temporary_password_validity_days = local.password_policy.temporary_password_validity_days
  }

  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  auto_verified_attributes = ["email"]

  username_attributes = ["email"]

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-customer-pool"
  })
}

resource "aws_cognito_user_pool_client" "customer" {
  name         = "${var.project}-${var.environment}-customer-client"
  user_pool_id = aws_cognito_user_pool.customer.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = var.access_token_validity_hours
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "hours"
    refresh_token = "days"
  }
}

# ─── Admin User Pool ──────────────────────────────────────────────────────────

resource "aws_cognito_user_pool" "admin" {
  name = "${var.project}-${var.environment}-admin-pool"

  password_policy {
    minimum_length                   = local.password_policy.minimum_length
    require_numbers                  = local.password_policy.require_numbers
    require_symbols                  = local.password_policy.require_symbols
    temporary_password_validity_days = local.password_policy.temporary_password_validity_days
  }

  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  auto_verified_attributes = ["email"]

  username_attributes = ["email"]

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-admin-pool"
  })
}

resource "aws_cognito_user_pool_client" "admin" {
  name         = "${var.project}-${var.environment}-admin-client"
  user_pool_id = aws_cognito_user_pool.admin.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = var.access_token_validity_hours
  refresh_token_validity = var.refresh_token_validity_days

  token_validity_units {
    access_token  = "hours"
    refresh_token = "days"
  }
}
