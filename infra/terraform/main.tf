terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# ─── Providers ───────────────────────────────────────────────────────────────

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# WAF for CloudFront must be provisioned in us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}

# ─── Networking ──────────────────────────────────────────────────────────────

module "networking" {
  source = "./modules/networking"

  environment        = terraform.workspace
  project            = var.project
  enable_nat_gateway = local.config.is_production
}

# ─── EKS ─────────────────────────────────────────────────────────────────────

module "eks" {
  source = "./modules/eks"

  cluster_name        = "${var.project}-${terraform.workspace}"
  environment         = terraform.workspace
  project             = var.project
  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  node_min_size       = local.config.eks_node_min
  node_max_size       = local.config.eks_node_max
  node_desired_size   = local.config.eks_node_min
  node_instance_type  = "m7i-flex.large"
  kms_key_arn         = module.kms.key_arn
}

# ─── KMS ─────────────────────────────────────────────────────────────────────

module "kms" {
  source = "./modules/kms"

  environment = terraform.workspace
  project     = var.project
  owner       = var.owner
}

# ─── Secrets Manager ─────────────────────────────────────────────────────────

module "secrets" {
  source = "./modules/secrets"

  environment         = terraform.workspace
  project             = var.project
  owner               = var.owner
  kms_key_arn         = module.kms.key_arn
  rotation_lambda_arn = var.rotation_lambda_arn
}

# ─── RDS ─────────────────────────────────────────────────────────────────────

module "rds" {
  source = "./modules/rds"

  environment            = terraform.workspace
  project                = var.project
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  rds_sg_id              = module.networking.rds_sg_id
  kms_key_arn            = module.kms.key_arn
  db_password_secret_arn = module.secrets.secret_arn
  multi_az               = local.config.rds_multi_az
  create_read_replica    = local.config.is_production
}

# ─── ElastiCache ─────────────────────────────────────────────────────────────

module "elasticache" {
  source = "./modules/elasticache"

  environment                = terraform.workspace
  project                    = var.project
  owner                      = var.owner
  is_production              = local.config.elasticache_multi_az
  vpc_id                     = module.networking.vpc_id
  subnet_ids                 = module.networking.private_subnet_ids
  allowed_security_group_ids = [module.networking.eks_nodes_sg_id]
  create_security_group      = false
  existing_security_group_id = module.networking.redis_sg_id
}

# ─── Cognito ─────────────────────────────────────────────────────────────────

module "cognito" {
  source = "./modules/cognito"

  environment = terraform.workspace
  project     = var.project
  owner       = var.owner
}

# ─── SQS ─────────────────────────────────────────────────────────────────────

module "sqs" {
  source = "./modules/sqs"

  environment = terraform.workspace
  project     = var.project
  owner       = var.owner
}

# ─── S3 ──────────────────────────────────────────────────────────────────────

module "s3" {
  source = "./modules/s3"

  environment = terraform.workspace
  project     = var.project
  owner       = var.owner
  kms_key_arn = module.kms.key_arn
}

# ─── Lambda ──────────────────────────────────────────────────────────────────

module "lambda" {
  source = "./modules/lambda"

  environment               = terraform.workspace
  project                   = var.project
  owner                     = var.owner
  ecr_image_uri             = var.ecr_image_uri_invoice
  sqs_queue_arn             = module.sqs.queue_arn
  s3_bucket_arn             = module.s3.bucket_arn
  kms_key_arn               = module.kms.key_arn
  ses_from_email            = var.ses_from_email
  oidc_provider_arn         = module.eks.oidc_provider_arn
}

# ─── ECR ─────────────────────────────────────────────────────────────────────

module "ecr" {
  source = "./modules/ecr"

  environment = terraform.workspace
  project     = var.project
  owner       = var.owner
}

# ─── WAF (us-east-1 for CloudFront) ──────────────────────────────────────────

module "waf" {
  source = "./modules/waf"

  environment = terraform.workspace
  project     = var.project
  owner       = var.owner

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}

# ─── CloudFront ──────────────────────────────────────────────────────────────
# NOTE: CloudFront origin points to the dedicated frontend service
# load balancer in EKS.

module "cloudfront" {
  source = "./modules/cloudfront"

  environment  = terraform.workspace
  project      = var.project
  owner        = var.owner
  alb_dns_name = "a0879b37672fa4da29fd26acaf2a6fb4-1508186753.us-east-1.elb.amazonaws.com"
  waf_acl_arn  = module.waf.web_acl_arn
}

# ─── Route 53 ────────────────────────────────────────────────────────────────

module "route53" {
  source = "./modules/route53"

  environment            = terraform.workspace
  project                = var.project
  owner                  = var.owner
  hosted_zone_id         = var.hosted_zone_id
  domain_name            = var.domain_name
  cloudfront_domain_name = module.cloudfront.distribution_domain_name
  eu_alb_dns_name        = module.cloudfront.distribution_domain_name
  us_alb_dns_name        = module.cloudfront.distribution_domain_name
}

# ─── Monitoring ──────────────────────────────────────────────────────────────

module "monitoring" {
  source = "./modules/monitoring"

  project                = var.project
  environment            = terraform.workspace
  owner                  = var.owner
  alb_arn_suffix         = var.alb_arn_suffix
  target_group_arn_suffixes = var.target_group_arn_suffixes
  rds_instance_id        = "disabled-rds"
  elasticache_cluster_id = module.elasticache.replication_group_id
  sqs_dlq_name           = module.sqs.dlq_name
  alert_email            = var.alert_email
}

# ─── X-Ray Distributed Tracing ───────────────────────────────────────────────

module "xray" {
  source = "./modules/xray"

  project     = var.project
  environment = terraform.workspace
  owner       = var.owner
}

# ─── CloudWatch Dashboard ─────────────────────────────────────────────────────

module "cloudwatch_dashboard" {
  source = "./modules/cloudwatch-dashboard"

  project                = var.project
  environment            = terraform.workspace
  cluster_name           = module.eks.cluster_name
  alb_arn_suffix         = var.alb_arn_suffix
  rds_instance_id        = "disabled-rds"
  elasticache_cluster_id = module.elasticache.replication_group_id
  sqs_queue_name         = module.sqs.queue_name
  sqs_dlq_name           = module.sqs.dlq_name
}

# ─── GuardDuty ───────────────────────────────────────────────────────────────

module "guardduty" {
  source = "./modules/guardduty"

  project       = var.project
  environment   = terraform.workspace
  owner         = var.owner
  sns_topic_arn = module.monitoring.sns_topic_arn
  enable_guardduty = false
}

# ─── Client VPN ──────────────────────────────────────────────────────────────

module "vpn" {
  source = "./modules/vpn"

  environment            = terraform.workspace
  project                = var.project
  owner                  = var.owner
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  server_certificate_arn = var.server_certificate_arn
  client_certificate_arn = var.client_certificate_arn
  saml_provider_arn      = var.saml_provider_arn
  internal_alb_cidr      = "10.0.0.0/16"
  vpc_dns_ip             = cidrhost("10.0.0.0/16", 2)
}
