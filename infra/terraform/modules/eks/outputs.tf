output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "Endpoint URL of the EKS cluster API server"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_ca_certificate" {
  description = "Base64-encoded certificate authority data for the EKS cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "oidc_provider_arn" {
  description = "ARN of the OIDC identity provider for IRSA"
  value       = aws_iam_openid_connect_provider.eks.arn
}

output "oidc_provider_url" {
  description = "URL of the OIDC identity provider for IRSA"
  value       = aws_iam_openid_connect_provider.eks.url
}

output "catalog_irsa_role_arn" {
  description = "ARN of the IRSA IAM role for the catalog service"
  value       = aws_iam_role.irsa_catalog.arn
}

output "cart_irsa_role_arn" {
  description = "ARN of the IRSA IAM role for the cart service"
  value       = aws_iam_role.irsa_cart.arn
}

output "checkout_irsa_role_arn" {
  description = "ARN of the IRSA IAM role for the checkout service"
  value       = aws_iam_role.irsa_checkout.arn
}

output "auth_irsa_role_arn" {
  description = "ARN of the IRSA IAM role for the auth service"
  value       = aws_iam_role.irsa_auth.arn
}

output "admin_irsa_role_arn" {
  description = "ARN of the IRSA IAM role for the admin service"
  value       = aws_iam_role.irsa_admin.arn
}

output "invoice_lambda_irsa_role_arn" {
  description = "ARN of the IRSA IAM role for the invoice-lambda function"
  value       = aws_iam_role.irsa_invoice_lambda.arn
}

output "fluent_bit_irsa_role_arn" {
  description = "ARN of the IRSA IAM role for the Fluent Bit DaemonSet"
  value       = aws_iam_role.irsa_fluent_bit.arn
}
