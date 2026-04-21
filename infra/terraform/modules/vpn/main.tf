locals {
  common_tags = {
    environment = var.environment
    project     = var.project
    owner       = var.owner
  }

  # Use federated (SAML) auth when a SAML provider ARN is supplied, otherwise certificate-only
  use_saml = var.saml_provider_arn != null

  authentication_options = local.use_saml ? [
    {
      type                           = "certificate-authentication"
      root_certificate_chain_arn     = var.client_certificate_arn
      saml_provider_arn              = null
      self_service_saml_provider_arn = null
    },
    {
      type                           = "federated-authentication"
      root_certificate_chain_arn     = null
      saml_provider_arn              = var.saml_provider_arn
      self_service_saml_provider_arn = null
    }
  ] : [
    {
      type                           = "certificate-authentication"
      root_certificate_chain_arn     = var.client_certificate_arn
      saml_provider_arn              = null
      self_service_saml_provider_arn = null
    }
  ]
}

# ─── Security Group for VPN Endpoint ─────────────────────────────────────────

resource "aws_security_group" "vpn_sg" {
  name        = "${var.project}-${var.environment}-vpn-sg"
  description = "Security group for AWS Client VPN endpoint"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow VPN clients to reach Internal ALB CIDR"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.internal_alb_cidr]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-vpn-sg"
  })
}

# ─── Client VPN Endpoint ──────────────────────────────────────────────────────

resource "aws_ec2_client_vpn_endpoint" "main" {
  description            = "${var.project}-${var.environment} Client VPN"
  server_certificate_arn = var.server_certificate_arn
  client_cidr_block      = var.client_cidr_block
  split_tunnel           = true
  vpc_id                 = var.vpc_id
  security_group_ids     = [aws_security_group.vpn_sg.id]

  dns_servers = [var.vpc_dns_ip]

  dynamic "authentication_options" {
    for_each = local.authentication_options
    content {
      type                       = authentication_options.value.type
      root_certificate_chain_arn = authentication_options.value.root_certificate_chain_arn
      saml_provider_arn          = authentication_options.value.saml_provider_arn
    }
  }

  connection_log_options {
    enabled               = true
    cloudwatch_log_group  = aws_cloudwatch_log_group.vpn_logs.name
    cloudwatch_log_stream = aws_cloudwatch_log_stream.vpn_logs.name
  }

  tags = merge(local.common_tags, {
    Name = "${var.project}-${var.environment}-client-vpn"
  })
}

# ─── CloudWatch Logs for VPN connections ─────────────────────────────────────

resource "aws_cloudwatch_log_group" "vpn_logs" {
  name              = "/aws/vpn/${var.project}-${var.environment}"
  retention_in_days = 30

  tags = local.common_tags
}

resource "aws_cloudwatch_log_stream" "vpn_logs" {
  name           = "connections"
  log_group_name = aws_cloudwatch_log_group.vpn_logs.name
}

# ─── Subnet Associations ──────────────────────────────────────────────────────

resource "aws_ec2_client_vpn_network_association" "private" {
  count = length(var.private_subnet_ids)

  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.main.id
  subnet_id              = var.private_subnet_ids[count.index]
}

# ─── Authorization Rule — Internal ALB only ───────────────────────────────────

resource "aws_ec2_client_vpn_authorization_rule" "internal_alb" {
  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.main.id
  target_network_cidr    = var.internal_alb_cidr
  authorize_all_groups   = true
  description            = "Allow VPN clients to reach Internal ALB"
}

# ─── Route — Internal ALB CIDR via first private subnet ──────────────────────

resource "aws_ec2_client_vpn_route" "internal_alb" {
  client_vpn_endpoint_id = aws_ec2_client_vpn_endpoint.main.id
  destination_cidr_block = var.internal_alb_cidr
  target_vpc_subnet_id   = var.private_subnet_ids[0]
  description            = "Route to Internal ALB"

  depends_on = [aws_ec2_client_vpn_network_association.private]
}
