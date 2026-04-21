output "vpn_endpoint_id" {
  description = "ID of the AWS Client VPN endpoint"
  value       = aws_ec2_client_vpn_endpoint.main.id
}

output "vpn_endpoint_dns_name" {
  description = "DNS name of the AWS Client VPN endpoint"
  value       = aws_ec2_client_vpn_endpoint.main.dns_name
}
