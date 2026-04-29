locals {
  tags = {
    project     = var.project
    environment = var.environment
    owner       = var.owner
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------------------------
# X-Ray sampling rule — 5% of all requests across all services
# ---------------------------------------------------------------------------

resource "aws_xray_sampling_rule" "default" {
  rule_name      = "${var.project}-${var.environment}-default"
  priority       = 9000
  reservoir_size = 5
  fixed_rate     = 0.05
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"
  version        = 1

  tags = local.tags
}
