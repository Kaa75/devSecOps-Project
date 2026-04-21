locals {
  env_config = {
    production = {
      is_production         = true
      eks_node_min          = 2
      eks_node_max          = 6
      rds_multi_az          = true
      elasticache_multi_az  = true
    }
    development = {
      is_production         = false
      eks_node_min          = 1
      eks_node_max          = 3
      rds_multi_az          = false
      elasticache_multi_az  = false
    }
  }

  config = local.env_config[terraform.workspace]

  common_tags = {
    environment = terraform.workspace
    project     = var.project
    owner       = var.owner
  }
}
