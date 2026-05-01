locals {
  env_config = {
    default = {
      is_production        = false
      eks_node_min         = 1
      eks_node_desired     = 1
      eks_node_max         = 2
      rds_multi_az         = false
      elasticache_multi_az = false
    }
    production = {
      is_production        = true
      eks_node_min         = 2
      eks_node_desired     = 2
      eks_node_max         = 6
      rds_multi_az         = true
      elasticache_multi_az = true
    }
    development = {
      is_production        = false
      eks_node_min         = 1
      eks_node_desired     = 2
      eks_node_max         = 2
      rds_multi_az         = false
      elasticache_multi_az = false
    }
  }

  config = local.env_config[terraform.workspace]

  common_tags = {
    environment = terraform.workspace
    project     = var.project
    owner       = var.owner
  }
}
