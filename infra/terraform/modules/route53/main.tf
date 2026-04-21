locals {
  common_tags = {
    project     = var.project
    environment = var.environment
    owner       = var.owner
  }
}

# Latency-based routing record — EU (eu-west-1)
resource "aws_route53_record" "eu" {
  zone_id        = var.hosted_zone_id
  name           = var.domain_name
  type           = "CNAME"
  ttl            = 60
  set_identifier = "eu"
  records        = [var.eu_alb_dns_name]

  latency_routing_policy {
    region = "eu-west-1"
  }
}

# Latency-based routing record — US (us-east-1)
resource "aws_route53_record" "us" {
  zone_id        = var.hosted_zone_id
  name           = var.domain_name
  type           = "CNAME"
  ttl            = 60
  set_identifier = "us"
  records        = [var.us_alb_dns_name]

  latency_routing_policy {
    region = "us-east-1"
  }
}

# Alias record for the apex domain pointing to CloudFront
# CloudFront's hosted zone ID is always Z2FDTNDATAQYW2 (AWS global constant)
resource "aws_route53_record" "apex" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}
